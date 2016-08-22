import { Session } from 'meteor/session';

renderCallTemplate = function(template) {
    Session.set("currentPhoneCall", null);
    Session.set("phoneIsRinging", false);
    Session.set("remoteIceCandidates", []);
    Session.set("callState", null);
    Session.set("");
    if (!template) var self = this;
    else var self = template;
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
        let newIncomingCall = Meteor.VideoCallServices.VideoChatCallLog.findOne({
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
            Meteor.VideoCallServices.VideoChatCallLog.update({
                _id: newIncomingCall._id
            }, {
                $set: {
                    status: "R",
                    conn_dt: new Date().getTime()
                }
            });
            Meteor.VideoCallServices.onReceivePhoneCall();
        }
        let answeredCall = Meteor.VideoCallServices.VideoChatCallLog.findOne({
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
        let ignoredCall = Meteor.VideoCallServices.VideoChatCallLog.findOne({
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

        let cancelledCall = Meteor.VideoCallServices.VideoChatCallLog.findOne({
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
        let iceFailed = Meteor.VideoCallServices.VideoChatCallLog.findOne({
            _id: Session.get("currentPhoneCall"),
            status: "IF",

            callee_id: Meteor.userId()
        })
        if (iceFailed) {
            Meteor.VideoCallServices._loadRTCConnection();
            Meteor.VideoCallServices._setUpCalleeEvents();
            Meteor.VideoCallServices._setUpMixedEvents();
            Meteor.VideoCallServices.peerConnection.addStream(Meteor.localStream);
            Meteor.VideoCallServices.VideoChatCallLog.update({
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
        let callFailed = Meteor.VideoCallServices.VideoChatCallLog.findOne({
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
            let currentPhoneCall = Meteor.VideoCallServices.VideoChatCallLog.findOne({
                _id: Session.get("currentPhoneCall")
            });
            let caller = currentPhoneCall.caller_id == Meteor.userId();
            message = JSON.parse(message);
            if (message.msg == "changed" && message.collection == "VideoChatCallLog" && message.fields != undefined) {
                if (caller) {
                    console.log("caller", message);

                    if (message.fields.ice_callee != undefined) {
                        console.log("ice callee", message.fields);
                        let iceCaller = message.fields.ice_callee;

                        Meteor.VideoCallServices.peerConnection.addIceCandidate(
                            new RTCIceCandidate(JSON.parse(iceCaller)),
                            function() {

                            },
                            function(err) {
                                console.log(err);
                            });


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
                            console.log("EY");
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
                                Meteor.VideoCallServices.VideoChatCallLog.update({
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
                        const ice = message.fields.ice_caller;
                        console.log("loadingIce", message);
                        console.log("iceString", ice, ice.string);
                        Meteor.VideoCallServices.peerConnection.addIceCandidate(
                            new RTCIceCandidate(JSON.parse(ice)));

                    }
                }
            }
        }
    });

}
