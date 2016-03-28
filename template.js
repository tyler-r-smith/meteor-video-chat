Template.registerHelper("incomingPhoneCall", function() {
    return Session.get("phoneIsRinging");
});
Template.body.onRendered(function() {
    Session.set("currentPhoneCall", null);
    Session.set("phoneIsRinging", false);
    Session.set("remoteIceCandidates", []);
    let self = this;
    /*
     *   Autorun is used to detect changes in the publication. 
     *   The functionality triggered by changes is used to devise as to 
     *   whether the phone is ringing. 
     *
     */
    self.autorun(function() {
        self.subscribe("VideoCallChatLog");
        let newIncomingCall = VideoChatCallLog.findOne({
            status: "C",
            callee_id: Meteor.userId()
        });
        if (newIncomingCall) {
            Session.set("localIceCandidates", []);
            Session.set("addedIceCandidates", null)
            console.log("incoming call")
            Session.set("currentPhoneCall", newIncomingCall._id);
            Meteor.VideoCallServices.startRingtone();
            Meteor.VideoCallServices._loadRTCConnection();
            Meteor.VideoCallServices._setUpCalleeEvents();
            Meteor.VideoCallServices._setUpMixedEvents();
            VideoChatCallLog.update({
                _id: newIncomingCall._id
            }, {
                $set: {
                    status: "R",
                    conn_dt: new Date().getTime()
                }
            });
            Meteor.VideoCallServices.onReceivePhoneCall();
        }
        let answeredCall = VideoChatCallLog.findOne({
            status: "A",
            callee_id: Meteor.userId()
        });
        if (answeredCall) {
            Session.set("inCall");
            Meteor.VideoCallServices.stopRingtone();
        }
        let ignoredCall = VideoChatCallLog.findOne({
            _id: Session.get("currentPhoneCall"),
            caller_id: Meteor.userId(),
            status: "IG"
        });
        if (ignoredCall)
            Meteor.VideoCallServices.onCallIgnored();

        let cancelledCall = VideoChatCallLog.findOne({
            _id: Session.get("currentPhoneCall"),
            status: "D"
        })
        if (cancelledCall)
            Meteor.VideoCallServices.callTerminated();
        if (Session.get("currentPhoneCall") == null)
            Meteor.VideoCallServices.callTerminated();
    });

    /*
     *   Read the DDP stream directly to detect changes in state. 
     *
     */
    Meteor.connection._stream.on('message', function(message) {
        if (Session.get("currentPhoneCall")) {
            let currentPhoneCall = VideoChatCallLog.findOne({
                _id: Session.get("currentPhoneCall")
            });
            let caller = currentPhoneCall.caller_id == Meteor.userId();
            message = JSON.parse(message);
            if (message.msg == "changed" && message.collection == "VideoChatCallLog") {
                if (caller) {
                    console.log("caller", message);
                    if (message.fields.ice_callee != undefined) {
                        console.log("ice callee", message.fields);
                        let iceCallers = message.fields.ice_callee;
                        for (let i = 0; i < iceCallers.length; i++) {
                            let ice = iceCallers[i];
                            if (!ice.seen) {
                                console.log("loadingIce", ice);
                                Meteor.VideoCallServices.peerConnection.addIceCandidate(
                                    new RTCIceCandidate(JSON.parse(ice.string)));
                                let query = {};
                                query["ice_callee." + i] = {
                                    seen: true,
                                    string: ice.string
                                }
                                console.log(query);
                                VideoChatCallLog.update({
                                    _id: Session.get("currentPhoneCall")
                                }, {
                                    $set: query
                                })
                            }
                        };
                    }
                    if (message.fields.SDP_callee != undefined) {
                        console.log("sdp_callee");
                        Meteor.VideoCallServices.peerConnection.setRemoteDescription(new RTCSessionDescription(
                                JSON.parse(message.fields.SDP_callee)
                            ))
                            .done(function() {});
                    }
                    if (message.fields.status != undefined) {
                        if (message.fields.status == currentPhoneCall.callee_id)
                            Meteor.VideoCallServices.callTerminated();
                        if (message.fields.status == "CAN")
                            Meteor.VideoCallServices.callTerminated();
                        if (message.fields.status == "A") {
                            Meteor.VideoCallServices._createLocalOffer();
                            Meteor.VideoCallServices._setUpCallerEvents();
                            Meteor.VideoCallServices._setUpMixedEvents();
                        }
                    }
                }
                else {

                    if (message.fields.status != undefined)
                        if (message.fields.status == currentPhoneCall.caller_id)
                            Meteor.VideoCallServices.callTerminated();
                    if (message.fields.SDP_caller != undefined) {
                        Meteor.VideoCallServices.peerConnection.setRemoteDescription(new RTCSessionDescription(
                                JSON.parse(message.fields.SDP_caller)
                            ))
                            .done(function() {
                                Meteor.VideoCallServices.peerConnection.createAnswer()
                                    .done(function(answer) {
                                        Meteor.VideoCallServices.peerConnection.setLocalDescription(answer);
                                        VideoChatCallLog.update({
                                            _id: Session.get("currentPhoneCall")
                                        }, {
                                            $set: {
                                                SDP_callee: JSON.stringify(answer)
                                            }
                                        });
                                    })
                            });
                    }
                    if (message.fields.ice_caller != undefined) {
                        let iceCallers = message.fields.ice_caller;
                        for (let i = 0; i < iceCallers.length; i++) {
                            let ice = iceCallers[i];
                            if (!ice.seen) {
                                console.log("loadingIce", ice);
                                Meteor.VideoCallServices.peerConnection.addIceCandidate(
                                    new RTCIceCandidate(JSON.parse(ice.string)));
                                let query = {};
                                query["ice_caller." + i] = {
                                    seen: true,
                                    string: ice.string
                                }
                                console.log(query);
                                VideoChatCallLog.update({
                                    _id: Session.get("currentPhoneCall")
                                }, {
                                    $set: query
                                })
                            }
                        };
                    }
                }
            }
        }
    });

})
