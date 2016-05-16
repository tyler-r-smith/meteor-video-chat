    VideoCallServices = {
        VideoChatCallLog: new Meteor.Collection("VideoChatCallLog"),
        /*
         *    Loop to ensure that expired sessions are disposed of
         *
         */
        validationLoop: Meteor.setInterval(function() {
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
                    $or: [{
                        status: "R"
                    }, {
                        status: "A"
                    }]

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

            },
            10000)
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
        insert: function() {
            return Meteor.user();
        }
    })