renderCallTemplate = function() {
    Session.set("currentPhoneCall", null);
    Session.set("phoneIsRinging", false);
    Session.set("remoteIceCandidates", []);
    Session.set("callState", null);
    Session.set("")
    let self = this;
    /*
     *   Autorun is used to detect changes in the publication. 
     *   The functionality triggered by changes is used to devise as to 
     *   whether the phone is ringing. 
     *
     */
    console.log("created");
    self.autorun(function() {
        console.log("call autorun");
        self.subscribe("VideoCallChatLog");
        let newIncomingCall = VideoChatCallLog.findOne({
            status: "C",
            callee_id: Meteor.userId()
        });
        if (newIncomingCall) {
            Session.set("localIceCandidates", []);
            Session.set("addedIceCandidates", null)
            console.log("incoming call")
            Session.set("callState", {
                message: "Received Call",
                status: "R",
                caller: newIncomingCall.caller_id,
                callee: newIncomingCall.callee_id,
                timestamp: new Date()
            });
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
            Session.set("callState", {
                message: "Answered",
                status: "A",
                caller: answeredCall.caller_id,
                callee: answeredCall.callee_id,
                timestamp: new Date()
            });
        }
        let ignoredCall = VideoChatCallLog.findOne({
            _id: Session.get("currentPhoneCall"),
            caller_id: Meteor.userId(),
            status: "IG"
        });
        if (ignoredCall) {
            Meteor.VideoCallServices.onCallIgnored();
            Session.set("callState", {
                message: "Ignored",
                status: "IG",

                caller: ignoredCall.caller_id,
                callee: ignoredCall.callee_id,
                timestamp: new Date()
            })
        }

        let cancelledCall = VideoChatCallLog.findOne({
            _id: Session.get("currentPhoneCall"),
            status: "D"
        })
        if (cancelledCall) {
            Meteor.VideoCallServices.callTerminated();
            Session.get("callState", {
                message: "Cancelled",
                status: "D",
                caller: cancelledCall.caller_id,
                callee: cancelledCall.callee_id,
                timestamp: new Date()
            })
        }
        let iceFailed = VideoChatCallLog.findOne({
            _id: Session.get("currentPhoneCall"),
            status: "IF",

            callee_id: Meteor.userId()
        })
        if (iceFailed) {
            Meteor.VideoCallServices._loadRTCConnection();
            Meteor.VideoCallServices._setUpCalleeEvents();
            Meteor.VideoCallServices._setUpMixedEvents();
            Meteor.VideoCallServices.peerConnection.addStream(Meteor.localStream);
            VideoChatCallLog.update({
                _id: Session.get("currentPhoneCall")
            }, {
                $set: {
                    status: "IRS"
                }
            })
            Session.set("callState", {
                message: "Ice failed, retrying connection",
                status: "IRS",
                caller: iceFailed.caller_id,
                callee: iceFailed.callee_id,
                timestamp: new Date()
            })
        }
        let callFailed = VideoChatCallLog.findOne({
            _id: Session.get("currentPhoneCall"),
            status: "F"
        })
        if (callFailed) {
            Meteor.VideoCallServices.callTerminated();
            Session.set("callState", {
                message: "Call failed",
                status: "F",
                caller: iceFailed.caller_id,
                callee: iceFailed.callee_id,

                timestamp: new Date()
            })
        }
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
                        ), function() {}, function() {})

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
                        if (message.fields.status == "IRS") {
                            Meteor.VideoCallServices._loadRTCConnection();
                            Meteor.VideoCallServices._createLocalOffer();
                            Meteor.VideoCallServices._setUpCallerEvents();
                            Meteor.VideoCallServices._setUpMixedEvents();
                            Meteor.VideoCallServices.peerConnection.addStream(Meteor.localStream);
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
                        ), () => {
                            Meteor.VideoCallServices.peerConnection.createAnswer((answer) => {
                                Meteor.VideoCallServices.peerConnection.setLocalDescription(answer);
                                VideoChatCallLog.update({
                                    _id: Session.get("currentPhoneCall")
                                }, {
                                    $set: {
                                        SDP_callee: JSON.stringify(answer)
                                    }
                                });
                            }, function() {})

                        }, function() {})

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

}
