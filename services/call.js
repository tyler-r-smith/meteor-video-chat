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
        }
        onReceivePhoneCall() {

        }
        onCallTerminated() {

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
                            window.VideoCallServices.stopRingtone();
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
                    window.VideoCallServices.peerConnection.close()
                    window.localStream.stop();
                    window.VideoCallServices.peerConnection = {};
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
                        window.VideoCallServices._loadRTCConnection();
                    window.localStream = stream;
                    window.VideoCallServices.peerConnection.addStream(window.localStream);
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
                localVideo.src = window.URL.createObjectURL(stream);
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
                this.peerConnection = new RTCPeerConnection({"iceServers":[{
                    url: 'stun:stun.l.google.com:19302'
                }, {
                    url: 'stun:stun1.l.google.com:19302'
                }, {
                    url: 'stun:stun2.l.google.com:19302'
                }, {
                    url: 'stun:stun3.l.google.com:19302'
                }, {
                    url: 'stun:stun4.l.google.com:19302'
                }, {
                    url: 'turn:numb.viagenie.ca',
                    credential: 'muazkh',
                    username: 'webrtc@live.com'
                }, {
                    url: 'turn:192.158.29.39:3478?transport=udp',
                    credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
                    username: '28224511:1379330808'
                }, {
                    url: 'turn:192.158.29.39:3478?transport=tcp',
                    credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
                    username: '28224511:1379330808'
                }]});
            }
            /*
             *   Create the local SDP offer and insert it into the database
             *
             */
        _createLocalOffer() {
                window.VideoCallServices.peerConnection.createOffer().done(function(desc) {
                    console.log("createOffer", desc);
                    console.log(Session.get("currentPhoneCall"));
                    console.log(VideoChatCallLog.update({
                        _id: Session.get("currentPhoneCall")
                    }, {
                        $set: {
                            SDP_caller: JSON.stringify(desc)
                        }
                    }))
                    window.VideoCallServices.peerConnection.setLocalDescription(desc);

                })
            }
            /**
             * Set up the event handlers for the caller
             *
             */
        _setUpCallerEvents() {
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
                    var video = document.getElementById(window.VideoCallServices.remoteVideoHTMLId);
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
                console.log(window.VideoCallServices.remoteVideoHTMLId);
                var video = document.getElementById(window.VideoCallServices.remoteVideoHTMLId);
                video.src = URL.createObjectURL(event.stream);
                video.play();
            };
        }
        _setUpMixedEvents() {
            this.peerConnection.oniceconnectionstatechange = function(event) {
                console.log("ice change", JSON.stringify(event));
            }
            this.peerConnection.onsignalingstatechange = function(event) {
                console.log("state change", JSON.stringify(event));
            };

        }
        setRingtone(ringtoneUrl) {
            this.ringtone = new Audio(ringtoneUrl);
            this.ringtone.loop = true;
        }
        startRingtone() {
            console.log("startringtone", this);
            if (this.ringtone != undefined)
                this.ringtone.play();
            Session.set("phoneIsRinging", true);
        }
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
                    callee_con_result: ""
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
    };
    window.VideoCallServices = VideoCallServices;
}
