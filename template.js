let Ringtone = function(on) {
    if (window.ringtone) {
        if (on) {
            if (window.ringtone.paused)
                window.ringtone.play();
        }
        else {
            window.ringtone.pause();
            window.ringtone.currentTime = 0;
            console.log("call ended", new Date());
            return on;
        }
    }
}
Template.registerHelper("incomingPhoneCall", function() {

    return Session.get("phoneIsRinging");
});
Template.body.onRendered(function() {
    Session.set("currentPhoneCall", null);
    Session.set("phoneIsRinging", false);
    window.ringtone = new Audio('http://178.62.110.73:3000/nokia.mp3');
    window.ringtone.loop = true;
    let self = this;
    // log received messages

    self.autorun(function() {
        console.log("auto");
        self.subscribe("VideoCallChatLog");
        let newIncomingCall = VideoChatCallLog.findOne({
            status: "C",
            callee_id: Meteor.userId()
        });
        if (newIncomingCall) {
            VideoChatCallLog.update({
                _id: newIncomingCall._id
            }, {
                $set: {
                    status: "R",
                    conn_dt: new Date().getTime()
                }
            });
            Session.set("phoneIsRinging", true);
            Session.set("currentPhoneCall", newIncomingCall._id);
        }


        /*     let timestamp = new Date().getTime();
             if (Meteor.userId()) {
                
                 Session.set("firstVideoCheck", true);
                 
                 let receivedCall = VideoChatCallLog.findOne({
                     status: "R",
                     callee_id: Meteor.userId(),
                     call_dt: {
                         $gt: timestamp - 30000
                     }
                 })
                 if (incomingCall) {
                     VideoChatCallLog.update({
                         _id: incomingCall._id
                     }, {
                         $set: {
                             conn_dt: new Date().getTime(),
                             status: "R",
                         }
                     })
                     Session.set("currentPhoneCall", incomingCall._id);
                     Session.set("phoneIsRinging", true);
                     Ringtone(true);
                 }
                 let currentOutgoingCall = VideoChatCallLog.findOne({
                     status: "A",
                     caller_id: Meteor.userId()
                 })
                 if (currentOutgoingCall) {
                     console.log(currentOutgoingCall);
                     for (let i = 0; i < currentOutgoingCall.ice_callee.length; i++) {
                         let thisCalleeIce = currentOutgoingCall.ice_callee[i];

                         if (thisCalleeIce.ice != null) {
                             let thisIceData = JSON.parse(thisCalleeIce.ice);
                             if (!thisCalleeIce.used) {
                                 window.myPeerConnection.addIceCandidate(
                                     new RTCIceCandidate(thisIceData));
                                 VideoChatCallLog.update({
                                     _id: Session.get("currentPhoneCall"),
                                     "ice_callee.ice": thisCalleeIce.ice
                                 }, {
                                     $set: {
                                         "ice_callee.$.used": true
                                     }
                                 })

                             }
                         }
                     }
                     if (currentOutgoingCall.sdp_callee != "") {
                         if (window.myPeerConnection.remoteDescription == null) {
                             let remoteDesc = JSON.parse(currentOutgoingCall.sdp_callee);
                             window.myPeerConnection.setRemoteDescription(remoteDesc, function() {}, function() {});
                         }
                     }
                 }




                 /* else {
                      Session.set("currentPhoneCall", false);
                      Ringtone(false)
                  }
             }*/
    })

    Meteor.connection._stream.on('message', function(message) {
        if (Session.get("currentPhoneCall")) {
            let currentPhoneCall = VideoChatCallLog.findOne({
                _id: Session.get("currentPhoneCall")
            });
            let caller = false;
            if (currentPhoneCall.caller_id == Meteor.userId())
                caller = true;
            message = JSON.parse(message);
            console.log(message);
            if (message.msg == "changed" && message.collection == "VideoChatCallLog") {
                if (caller) {
                    console.log("calelr", message);

                    if (message.fields.ice_callee != undefined) {
                        console.log("ice callee", message.fields);
                        let iceCallees = message.fields.ice_callee;

                        iceCallees.forEach(function(ice) {
                            window.myPeerConnection.addIceCandidate(
                                new RTCIceCandidate(ice));
                        });

                        console.log("WIN", window.myPeerConnection);

                    }
                    if (message.fields.sdp_callee != undefined) {
                        console.log("sdp_callee");
                        window.myPeerConnection.setRemoteDescription(new RTCSessionDescription(
                                JSON.parse(message.fields.sdp_callee)
                            ))
                            .done(function() {});
                    }
                }
                else {
                    console.log("caller", message);
                    if (message.fields.ice_callee != undefined) {
                        console.log("ice caller", message.fields);
                        let iceCaller = message.fields.ice_caller;
                        VideoChatCallLog.find({
                            _id: Session.get("currentPhoneCall")
                        }).forEach(function(doc) {
                            doc.ice_caller.forEach(function(iceTwo) {
                                window.myPeerConnection.addIceCandidate(
                                    new RTCIceCandidate(iceTwo));
                            })
                        })
                        console.log("WIN", window.myPeerConnection);
                    }
                    if (message.fields.sdp_caller) {
                        let videoCallData = VideoChatCallLog.findOne({
                            _id: Session.get("currentPhoneCall")
                        });
                        let remoteDesc = JSON.parse(videoCallData.SDP_caller);
                        console.log(remoteDesc);
                        if (!window.myPeerConnection)
                            VideoCallServices.CreatePeerConnection();
                        window.myPeerConnection.setRemoteDescription(new RTCSessionDescription(
                                remoteDesc
                            ))
                            .done(function() {

                            });
                        window.myPeerConnection.createAnswer()
                            .done(function(answer) {
                                window.myPeerConnection.setLocalDescription(answer);
                                VideoChatCallLog.update({
                                    _id: Session.get("currentPhoneCall")
                                }, {
                                    $set: {
                                        call_start_dt: new Date().getTime(),
                                        status: "A",
                                        sdp_callee: JSON.stringify(answer)
                                    }
                                })
                            });
                    }
                }

            }
        }
    });

})