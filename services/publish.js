Meteor.publish("VideoCallChatLog", function() {
    //Reactive computation to detect offline users 
    return VideoCallServices.VideoChatCallLog.find({
        $or: [{
            caller_id: this.userId
        }, {
            callee_id: this.userId
        }]
    });
});