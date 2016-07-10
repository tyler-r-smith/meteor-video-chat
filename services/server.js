    VideoCallServices = {
        VideoChatCallLog: new Meteor.Collection("VideoChatCallLog")
    };
    /*
     *   Allow users to update the connection data collection from the client side
     *   In a stable release there will be greater control of the people who can edit this. 
     *
     */
    VideoCallServices.VideoChatCallLog.allow({
        update: function(id, originalEntry, fieldBeingUpdated, query) {
            return Meteor.userId() == originalEntry.callee_id || Meteor.userId() == originalEntry.caller_id;

        },
        insert: function(id, entry) {
            if (Meteor.user()) {
                let callee = entry.callee_id;
                let calleeInCall = VideoCallServices.VideoChatCallLog.findOne({
                    callee_id: callee,
                    status: {
                        $in: ["R", "A", "CON"]
                    }
                })
                let callMadeButDesposedOf = VideoCallServices.VideoChatCallLog.findOne({
                    callee_id: callee,
                    status: "C"
                })
                if (callMadeButDesposedOf) {
                    VideoCallServices.VideoChatCallLog.update({
                        _id: callMadeButDesposedOf._id
                    }, {
                        $set: {
                            status: "F"
                        }
                    })
                }
                if (calleeInCall) {
                    throw new Meteor.Error(500, "Callee is currently in a call");
                    return false;
                }
                else return true;
            }
            else return false;
        }
    })
    Meteor.users.find({
        "status.online": true
    }).observe({
        removed: function(user) {
            VideoCallServices.VideoChatCallLog.find({
                $and: [{
                    $or: [{
                        caller_id: user._id
                    }, {
                        callee_id: user._id
                    }]
                }, {
                    $or: [{
                        status: "R"
                    }, {
                        status: "IRS"
                    }, {
                        status: "A"
                    }]
                }]
            }).forEach(function(doc) {
                VideoCallServices.VideoChatCallLog.update({
                    _id: doc._id
                }, {
                    $set: {
                        status: "F"
                    }
                })
            });
            VideoCallServices.VideoChatCallLog.find({
                $and: [{
                    $or: [{
                        caller_id: user._id
                    }, {
                        callee_id: user._id
                    }],
                    status: "CON"
                }]
            }).forEach(function(doc) {
                VideoCallServices.VideoChatCallLog.update({
                    _id: doc._id
                }, {
                    $set: {
                        status: "FIN"
                    }
                })
            })
        }
    });