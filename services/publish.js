Meteor.publish("VideoCallChatLog", function() {
    //Reactive computation to detect offline users 
    let finish = new Date().getTime();
    //Handle user offline without connect
    VideoCallServices.VideoChatCallLog.find({
        status: "C"
    }).forEach(function(log) {
        Meteor.users.find({
            $or: [{
                _id: log.caller_id
            }, {
                _id: log.callee_id
            }]
        }).forEach(function(thisUser) {
            if (!thisUser.status.online)
                VideoCallServices.VideoChatCallLog.update({
                    _id: log._id
                }, {
                    $set: {
                        status: "DNC"
                    }
                })
        })
    });
    //handle call received and answered but user offline
    VideoCallServices.VideoChatCallLog.find({
        status: {
            $in: ["R", "A"]
        }
    }).forEach(function(log) {
        Meteor.users.find({
            $or: [{
                _id: log.caller_id
            }, {
                _id: log.callee_id
            }]
        }).forEach(function(thisUser) {
            if (!thisUser.status.online)
                VideoCallServices.VideoChatCallLog.update({
                    _id: log._id
                }, {
                    $set: {
                        status: "CAN"
                    }
                })
        })
    });
    return VideoCallServices.VideoChatCallLog.find({
        $or: [{
            caller_id: this.userId
        }, {
            callee_id: this.userId
        }]
    });
});