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
            console.log("incoming call")
            Session.set("currentPhoneCall", newIncomingCall._id);
            window.VideoCallServices.startRingtone();
            VideoChatCallLog.update({
                _id: newIncomingCall._id
            }, {
                $set: {
                    status: "R",
                    conn_dt: new Date().getTime()
                }
            });
            Modal.show("incomingCall");


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
                        let iceCallees = message.fields.ice_callee;
                        iceCallees.forEach(function(ice) {
                            let used = false;
                            let remoteIceCandidates = Session.get("remoteIceCandidates");
                            for (let i = 0; i < remoteIceCandidates.length; i++) {
                                if (ice.candidate == remoteIceCandidates[i])
                                    used = true;
                            }
                            if (!used) {
                                console.log("not used")
                                window.VideoCallServices.peerConnection.addIceCandidate(
                                    new RTCIceCandidate(ice));
                                remoteIceCandidates.push(ice.candidate);
                                Session.set("remoteIceCandidates", remoteIceCandidates);
                            }
                        });
                    }
                    if (message.fields.SDP_callee != undefined) {
                        console.log("sdp_callee");
                        window.VideoCallServices.peerConnection.setRemoteDescription(new RTCSessionDescription(
                                JSON.parse(message.fields.SDP_callee)
                            ))
                            .done(function() {});
                    }
                }
                else {
                    console.log("caller", message);
                    if (message.fields.ice_caller != undefined) {
                        let iceCalleers = message.fields.ice_caller;
                        iceCalleers.forEach(function(ice) {
                            let used = false;
                            let remoteIceCandidates = Session.get("remoteIceCandidates");
                            for (let i = 0; i < remoteIceCandidates.length; i++) {
                                if (ice.candidate == remoteIceCandidates[i].candidate)
                                    used = true;
                            }
                            if (!used) {
                                remoteIceCandidates.push(ice);
                                Session.set("remoteIceCandidates", remoteIceCandidates);
                            }
                        });
                        console.log("CALLEE ICE ADDED", window.VideoCallServices);
                    }

                }


            }
        }
    });

})
