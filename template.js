Template.registerHelper("incomingPhoneCall", function() {
    return Session.get("phoneIsRinging");
});
Template.body.onRendered(function() {
    Session.set("currentPhoneCall", null);
    Session.set("phoneIsRinging", false);
    Session.set("remoteIceCandidates", []);
    let self = this;
    // log received messages

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
            window.VideoCallServices.startRingtone();
            window.VideoCallServices._loadRTCConnection();
            window.VideoCallServices._setUpCalleeEvents();
            window.VideoCallServices._setUpMixedEvents();
            VideoChatCallLog.update({
                _id: newIncomingCall._id
            }, {
                $set: {
                    status: "R",
                    conn_dt: new Date().getTime()
                }
            });
            window.VideoCallServices.onReceivePhoneCall();
        }
        let answeredCall = VideoChatCallLog.findOne({
            status: "A",
            callee_id: Meteor.userId()
        });
        if (answeredCall) {
            Session.set("inCall");
            window.VideoCallServices.stopRingtone();
        }
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
                                window.VideoCallServices.peerConnection.addIceCandidate(
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
                        window.VideoCallServices.peerConnection.setRemoteDescription(new RTCSessionDescription(
                                JSON.parse(message.fields.SDP_callee)
                            ))
                            .done(function() {});
                    }
                    if (message.fields.status != undefined) {
                        if (message.fields.status == currentPhoneCall.callee_id)
                            window.VideoCallServices.callTerminated();
                        if (message.fields.status == "CAN")
                            window.VideoCallServices.callTerminated();
                        if (message.fields.status == "A") {
                            window.VideoCallServices._createLocalOffer();
                            window.VideoCallServices._setUpCallerEvents();
                            window.VideoCallServices._setUpMixedEvents();
                        }
                    }
                }
                else {

                    if (message.fields.status != undefined)
                        if (message.fields.status == currentPhoneCall.caller_id)
                            window.VideoCallServices.callTerminated();
                    if (message.fields.SDP_caller != undefined) {
                        window.VideoCallServices.peerConnection.setRemoteDescription(new RTCSessionDescription(
                                JSON.parse(message.fields.SDP_caller)
                            ))
                            .done(function() {
                                window.VideoCallServices.peerConnection.createAnswer()
                                    .done(function(answer) {
                                        window.VideoCallServices.peerConnection.setLocalDescription(answer);
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
                                window.VideoCallServices.peerConnection.addIceCandidate(
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
