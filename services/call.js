VideoChatCallLog = new Meteor.Collection("VideoChatCallLog");
VideoCallServices;

if (Meteor.isServer) {
    VideoCallServices = {
        mainSub: Meteor.publish("VideoCallChatLog", function() {
            return VideoChatCallLog.find({
                $or: [{
                    caller_id: this.userId
                }, {
                    callee_id: this.userId
                }]
            });
        }),
        /*
         *    Loop to ensure that expired sessions are disposed of
         *
         */
        validationLoop: Meteor.setInterval(function() {
                let finish = new Date().getTime();

                //Handle user offline without connect
                VideoChatCallLog.find({
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
                            VideoChatCallLog.update({
                                _id: log._id
                            }, {
                                $set: {
                                    status: "DNC"
                                }
                            })
                    })
                });

                //handle call received and answered but user offline
                VideoChatCallLog.find({
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
                            VideoChatCallLog.update({
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
    VideoChatCallLog.allow({
        update: function() {
            return true;
        },
        insert: function() {
            return true;
        }
    })
}
else if (Meteor.isClient) {
    VideoCallServices = new class {
        constructor() {
                this.peerConnection = {};
                this.STUNTURN = null;
                this.connectionRetryLimit = 10;
            }
            //The following 3 functions are events which can be overriden
        onReceivePhoneCall() {

        }
        onCallTerminated() {

        }
        onCallIgnored() {

            }
            /*
             *   Terminate the call, if the call was successful, it will be populated with the userId of the terminator. 
             *
             */
        callTerminated() {
                if (Session.get("currentPhoneCall")) {
                    let thisCall = VideoChatCallLog.findOne({
                        _id: Session.get("currentPhoneCall")
                    });
                    if (thisCall.status == "A")
                        VideoChatCallLog.update({
                            _id: Session.get("currentPhoneCall")
                        }, {
                            $set: {
                                status: Meteor.userId(),
                                call_end_dt: new Date().getTime()
                            }
                        })
                    else if (thisCall.status == "R")
                        if (Meteor.userId() == thisCall.callee_id) {
                            Meteor.VideoCallServices.stopRingtone();
                            VideoChatCallLog.update({
                                _id: Session.get("currentPhoneCall")
                            }, {
                                $set: {
                                    status: "D"
                                }
                            })
                        }
                        else {
                            VideoChatCallLog.update({
                                _id: Session.get("currentPhoneCall")
                            }, {
                                $set: {
                                    status: "CAN"
                                }
                            })
                        }
                    try {
                        Meteor.VideoCallServices.peerConnection.close()
                    }
                    catch (e) {}
                    try {
                        Meteor.localStream.stop();
                    }
                    catch (e) {}
                    Meteor.VideoCallServices.peerConnection = {};
                }

                Session.set("currentPhoneCall", null);
                Session.set("remoteIceCandidates", []);
                this.onCallTerminated();
            }
            /*
             *   Get the local webcam stream, using a polyfill for cross-browser compatibility
             *
             */
        _getWebcam(loadPeer, callback) {
                navigator.polyfillGetWebcam = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia || navigator.mediaDevices.getUserMedia);
                navigator.polyfillGetWebcam({
                    video: true,
                    audio: true
                }, function(stream) {
                    if (loadPeer)
                        Meteor.VideoCallServices._loadRTCConnection();
                    Meteor.localStream = stream;
                    Meteor.VideoCallServices.peerConnection.addStream(Meteor.localStream);
                    return callback(stream);
                }, function() {});
            }
            /*
             *   Set the local RTC connection up
             *
             */
            /*
             *   Give the local stream an object reference and an HTML element to be displayed in
             *
             */
        loadLocalWebcam(loadPeer, callback) {
            let localVideoHTMLId = this.localVideoHTMLId;
            this._getWebcam(loadPeer, function(stream) {
                let localVideo = document.getElementById(localVideoHTMLId);
                console.log(this);
                localVideo.src = URL.createObjectURL(stream);
                localVideo.muted = true;
                localVideo.play();
                if (callback) return callback();
            });
        }
        setLocalWebcam(localVideoHTMLId) {
            this.localVideoHTMLId = localVideoHTMLId;
        }
        setRemoteWebcam(remoteVideoHTMLId) {
            this.remoteVideoHTMLId = remoteVideoHTMLId;
        }

        /*
         *   Load WebRTC API and initialise STUN and TURN servers
         *
         */
        _loadRTCConnection() {
                console.log(this);
                this.peerConnection = new RTCPeerConnection(this.STUNTURN);
            }
            /*
             *   Create the local SDP offer and insert it into the database
             *
             */
        _createLocalOffer() {
                Meteor.VideoCallServices.peerConnection.createOffer().done(function(desc) {
                    console.log("createOffer", desc);
                    console.log(Session.get("currentPhoneCall"));
                    console.log(VideoChatCallLog.update({
                        _id: Session.get("currentPhoneCall")
                    }, {
                        $set: {
                            SDP_caller: JSON.stringify(desc)
                        }
                    }))
                    Meteor.VideoCallServices.peerConnection.setLocalDescription(desc);

                })
            }
            /**
             * Set up the event handlers for the caller
             *
             */
        _setUpCallerEvents() {
                this.peerConnection.oniceconnectionstatechange = function(event) {
                      console.log(Meteor.VideoCallServices.peerConnection.iceConnectionState);
                      let pc = Meteor.VideoCallServices.peerConnection;
                      Meteor.VideoCallServices.peerConnection.getStats().done(function(dave, steve){
                          console.log("lol", dave, steve, this);
                      })
                  
                      if(pc.iceConnectionState =="failed"){
                       let currentSession = VideoChatCallLog.findOne({
                            _id: Session.get("currentPhoneCall")
                        });
                        if (currentSession.connection_retry_count <= Meteor.VideoCallServices.connectionRetryLimit) {
                            VideoChatCallLog.update({
                                _id: Session.get("currentPhoneCall")
                            }, {
                                $set: {
                                    status: "IF"
                                },

                                $inc: {
                                    connection_retry_count: 1
                                }
                            })
                        }
                        else
                            VideoCallChatLog.update({
                                _id: Session.get("currentUser")
                            }, {
                                $set: {
                                    status: "F"
                                }
                            });
                    }

                  console.log("iceChange");
                }
                this.peerConnection.onicecandidate = function(event) {
                    console.log(event.candidate);
                    if (event.candidate) {
                        VideoChatCallLog.update({
                            _id: Session.get("currentPhoneCall")
                        }, {
                            $push: {
                                ice_caller: {
                                    string: JSON.stringify(event.candidate),
                                    seen: false
                                }
                            }
                        })
                    }
                }
                this.peerConnection.onaddstream = function(event) {
                    console.log("addStream", event);
                    var video = document.getElementById(Meteor.VideoCallServices.remoteVideoHTMLId);
                    video.src = URL.createObjectURL(event.stream);
                    video.play();
                };
            }
            /**
             *   Set up event handlers for the callee
             * 
             */
        _setUpCalleeEvents() {
                this.peerConnection.onicecandidate = function(event) {
                    console.log(event.candidate);
                    if (event.candidate) {
                        VideoChatCallLog.update({
                            _id: Session.get("currentPhoneCall")
                        }, {
                            $push: {
                                ice_callee: {
                                    string: JSON.stringify(event.candidate),
                                    seen: false
                                }
                            }
                        })
                    }


                }
                this.peerConnection.onaddstream = function(event) {
                    console.log("addStream", event);
                    console.log(Meteor.VideoCallServices.remoteVideoHTMLId);
                    var video = document.getElementById(Meteor.VideoCallServices.remoteVideoHTMLId);
                    video.src = URL.createObjectURL(event.stream);
                    video.play();
                };
            }
            /*
             *   Set up the event handlers used by both caller and callee
             *
             */
        _setUpMixedEvents() {

                this.peerConnection.onsignalingstatechange = function(event) {
                    console.log("state change", JSON.stringify(event));
                };

            }
            // submit a url to set as the ringtone
        setRingtone(ringtoneUrl) {
                this.ringtone = new Audio(ringtoneUrl);
                this.ringtone.loop = true;
            }
            //Make the ringtone play
        startRingtone() {
                console.log("startringtone", this);
                if (this.ringtone != undefined)
                    this.ringtone.play();
                Session.set("phoneIsRinging", true);
            }
            //Stop it from playing
        stopRingtone() {
            console.log("stopringtone", this);
            if (this.ringtone != undefined)
                this.ringtone.pause();
            Session.set("phoneIsRinging", false);
        }

        /*
         *   Call the remote user by their meteor ID
         *
         */
        callRemote(remoteMeteorId) {
                Session.set("localIceCandidates", []);

                Session.set("currentPhoneCall", VideoChatCallLog.insert({
                    caller_id: Meteor.userId(),
                    call_dt: new Date().getTime(),
                    conn_dt: "",
                    call_start_dt: "",
                    call_end_dt: "",
                    status: "C",
                    callee_id: remoteMeteorId,
                    SDP_caller: "",
                    SDP_callee: "",
                    ice_caller: [],
                    ice_callee: [],
                    caller_con_result: "",
                    callee_con_result: "",
                    connection_retry_count: 0
                }))

            }
            /*
             *   Answer the call and set up WebRTC
             *
             */
        answerCall(events) {

                this.stopRingtone();
                VideoChatCallLog.update({
                    _id: Session.get("currentPhoneCall")
                }, {
                    $set: {
                        call_start_dt: new Date().getTime(),
                        status: "A"
                    }
                })
            }
            // this will trigger an event on the caller side
        ignoreCall() {
            VideoChatCallLog.update({
                _id: Session.get("currentPhoneCall")
            }, {
                $set: {
                    status: "IG"
                }
            })
        }
    };
    Meteor.VideoCallServices = VideoCallServices;
}
