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
    return Session.get("currentPhoneCall");
});
Template.body.onRendered(function() {
    window.ringtone = new Audio('http://178.62.110.73:3000/nokia.mp3');
    window.ringtone.loop = true;
    let self = this;
    self.autorun(function() {
        console.log("auto");
        let timestamp = new Date().getTime();
        if (Meteor.userId()) {
            self.subscribe("VideoCallChatLog");
            Session.set("firstVideoCheck", true);
            let incomingCall = VideoChatCallLog.findOne({
                status: "C",
                callee_id: Meteor.userId(),
                call_dt: {
                    $gt: timestamp - 30000
                }
            });
            let receivedCall = VideoChatCallLog.findOne({
                status: "R",
                callee_id: Meteor.userId(),
                call_dt: {
                    $gt: timestamp - 30000
                }
            })
            if (incomingCall) {
                Meteor.call('videoCall/calleeRecieved', {
                    id: incomingCall._id
                });
                Session.set("currentPhoneCall", incomingCall._id);
                Ringtone(true);
            }
            let currentOutgoingCall = VideoChatCallLog.findOne({
                status: "A",
                caller_id: Meteor.userId()
            })
            if (currentOutgoingCall) {
                for (let i = 0; i < currentOutgoingCall.ice_callee.length; i++) {
                    if (!currentOutgoingCall.ice_callee[i].used) {
                        window.myPeerConnection.addIceCandidate(
                            new RTCIceCandidate(currentOutgoingCall.ice_callee[i].ice));
                    
                        
                    }
                }
                if(currentOutgoingCall.sdp_callee !=""){
                    if(window.myPeerConnection.)
                }
            }




            /* else {
                 Session.set("currentPhoneCall", false);
                 Ringtone(false)
             }*/
        }
    })
})