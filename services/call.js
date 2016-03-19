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
                console.log("validationLoop");
                let finish = new Date().getTime();
                VideoChatCallLog.find({
                    status: "C"
                }).forEach(function(log) {
                    if (log.call_dt > finish + 30000) {
                        console.log("C", log);

                        VideoChatCallLog.update({
                            _id: log._id
                        }, {
                            $set: {
                                call_end_dt: finish,
                                status: "DNC"
                            }
                        })
                    }
                });
                VideoChatCallLog.find({
                    status: "R"
                }).forEach(function(log) {

                    if (log.call_dt > finish + 30000) {
                        console.log("R", log);
                        VideoChatCallLog.update({
                            _id: log._id
                        }, {
                            $set: {
                                call_end_dt: finish,
                                status: "M"
                            }
                        })
                    }
                })
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
                this.ringtone = new Audio('http://178.62.110.73:3000/nokia.mp3');
                this.ringtone.loop = true;
            }
            /*
             *   Get the local webcam stream, using a polyfill for cross-browser compatibility
             *
             */
        _getWebcam(callback) {
                navigator.polyfillGetWebcam = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia || navigator.mediaDevices.getUserMedia);
                navigator.polyfillGetWebcam({
                    video: true,
                    audio: true
                }, function(stream) {
                    window.VideoCallServices._loadRTCConnection();
                    window.VideoCallServices.peerConnection.addStream(stream)
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
        loadLocalWebcam(localVideoHTMLId) {
            console.log(this);
            if (this.localVideoHTMLId == undefined) {
                if (localVideoHTMLId == undefined)
                    throw new Meteor.error(500, "Please initialize a local video HTML ID in parameters, or using setLocalWebcam()");
            }
            else
                localVideoHTMLId = this.localVideoHTMLId;
            this._getWebcam(function(stream) {
                let localVideo = document.getElementById(localVideoHTMLId);
                console.log(this);
                localVideo.src = window.URL.createObjectURL(stream);
                localVideo.muted = true;
                localVideo.play();
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
                this.peerConnection = new RTCPeerConnection(STUNTURN);
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
                    if (event.candidate)
                        VideoChatCallLog.update({
                            _id: Session.get("currentPhoneCall")
                        }, {
                            $push: {
                                ice_caller: {
                                    candidate: event.candidate.candidate,
                                    id: event.candidate.sdpMid,
                                    label: event.candidate.sdpMLineIndex
                                }
                            }
                        })
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
                if (event.candidate)
                    VideoChatCallLog.update({
                        _id: Session.get("currentPhoneCall")
                    }, {
                        $push: {
                            ice_callee: {
                                candidate: event.candidate.candidate,
                                id: event.candidate.sdpMid,
                                label: event.candidate.sdpMLineIndex
                            }
                        }
                    })
            };
            this.peerConnection.onaddstream = function(event) {
                console.log("addStream", event);
                console.log(window.VideoCallServices.remoteVideoHTMLId);
                var video = document.getElementById(window.VideoCallServices.remoteVideoHTMLId);
                video.src = URL.createObjectURL(event.stream);
                video.play();
            };
        }
        startRingtone() {
            if (this.ringtone.paused)
                this.ringtone.play();
            Session.set("phoneIsRinging", true);
        }
        stopRingtone() {
            if (!this.ringtone.paused)
                this.ringtone.pause();
            Session.set("phoneIsRinging", false);
        }

        /*
         *   Call the remote user by their meteor ID
         *
         */
        callRemote(remoteMeteorId, events) {
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
                if (events)
                    if (events.created != undefined)
                        events.created();
                this._setUpCallerEvents()
                if (events)
                    if (events.setUpCallerEvents != undefined)
                        events.setUpCallerEvents();
                this._createLocalOffer();
                if (events)
                    if (events.localOfferCreated != undefined)
                        events.localOfferCreated();


            }
            /*
             *   Answer the call and set up WebRTC
             *
             */
        answerCall(events) {
            this.stopRingtone();
            this._setUpCalleeEvents()
            if (events)
                if (events.setUpCallerEvents != undefined)
                    events.setUpCallerEvents();
                //   this._setLocalWebcam();
            let callData = VideoChatCallLog.findOne({
                _id: Session.get("currentPhoneCall")
            });
            console.log(callData);
            this.peerConnection.setRemoteDescription(new RTCSessionDescription(
                    JSON.parse(callData.SDP_caller)
                ))
                .done(function() {
                    window.VideoCallServices.peerConnection.createAnswer()
                        .done(function(answer) {
                            window.VideoCallServices.peerConnection.setLocalDescription(answer);
                            VideoChatCallLog.update({
                                _id: Session.get("currentPhoneCall")
                            }, {
                                $set: {
                                    SDP_callee: JSON.stringify(answer)
                                }
                            });
                        })

                });





            console.log("ice", Session.get("remoteIceCandidates"));
            Session.get("remoteIceCandidates").forEach(function(ice) {
                window.VideoCallServices.peerConnection.addIceCandidate(
                    new RTCIceCandidate(ice));
            })

            if (events)
                if (events.peerConnectionLoaded != undefined)
                    events.peerConnectionLoaded();
            VideoChatCallLog.update({
                _id: Session.get("currentPhoneCall")
            }, {
                $set: {
                    call_start_dt: new Date().getTime(),
                    status: "A"
                }
            })
            if (events)
                if (events.phoneSetStateAnswer != undefined)
                    events.phoneSetStateAnswer();

        }

    };
    window.VideoCallServices = VideoCallServices;
}




if (Meteor.isServer) {
    Meteor.methods({
        "videoCall/makeCall": function(data) {
            return VideoChatCallLog.insert({
                caller_id: Meteor.userId(),
                call_dt: new Date().getTime(),
                conn_dt: "",
                call_start_dt: "",
                call_end_dt: "",
                status: "C",
                callee_id: data.id,
                SDP_caller: "",
                SDP_callee: "",
                ice_caller: [],
                ice_callee: [],
                caller_con_result: "",
                callee_con_result: ""
            });
        },
        'videoCall/calleeRecieved': function(data) {

        }
    })
}

STUNTURN = [{
    url: 'stun:stun01.sipphone.com'
}, {
    url: 'stun:stun.ekiga.net'
}, {
    url: 'stun:stun.fwdnet.net'
}, {
    url: 'stun:stun.ideasip.com'
}, {
    url: 'stun:stun.iptel.org'
}, {
    url: 'stun:stun.rixtelecom.se'
}, {
    url: 'stun:stun.schlund.de'
}, {
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
    url: 'stun:stunserver.org'
}, {
    url: 'stun:stun.softjoys.com'
}, {
    url: 'stun:stun.voiparound.com'
}, {
    url: 'stun:stun.voipbuster.com'
}, {
    url: 'stun:stun.voipstunt.com'
}, {
    url: 'stun:stun.voxgratia.org'
}, {
    url: 'stun:stun.xten.com'
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
}];