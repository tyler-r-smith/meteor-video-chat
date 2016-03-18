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
        testSub: Meteor.publish("VideoCallChatLogtest", function() {
            return VideoChatCallLog.find();
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
            1000)
    };
    VideoChatCallLog.allow({
        update: function() {
            return true;
        }
    })
}
else if (Meteor.isClient) {
    VideoCallServices = {
        Call: function(callee_id) {
            Meteor.call("videoCall/makeCall", {
                id: callee_id
            }, function(err, res) {
                Session.set("currentPhoneCall", res);
            });
            navigator.getWebcam = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia || navigator.mediaDevices.getUserMedia);
            navigator.getWebcam({
                video: true,
                audio: true
            }, function(stream) {
                let localVideo = document.getElementById("videoChatCallerVideo");
                localVideo.src = window.URL.createObjectURL(stream);
                localVideo.muted = true;
                localVideo.play();
                if (!window.myPeerConnection)
                    VideoCallServices.CreatePeerConnection();
                window.myPeerConnection.onicecandidate = function(event) {
                    console.log(event.candidate);
                    if (event.candidate)
                        VideoChatCallLog.update({
                            _id: Session.get("currentPhoneCall")
                        }, {
                            $push: {
                                ice_caller: {
                                    candidate: event.candidate.candidate,
                                    sdpMid: event.candidate.sdpMid,
                                    sdpMLineIndex: event.candidate.sdpMLineIndex
                                }
                            }
                        })
                };
                window.myPeerConnection.onaddstream = function(event) {
                    console.log("STRAIM", event);
                    var video = document.getElementById("videoChatCallerVideo");
                    video.src = URL.createObjectURL(event.stream);
                    video.play();
                };
                console.log("DARP", window.myPeerConnection);
                window.myPeerConnection.addStream(stream);
                window.myPeerConnection.createOffer()
                    .done(function(desc) {
                        window.myPeerConnection.setLocalDescription(desc)
                        VideoChatCallLog.update({
                            _id: Session.get("currentPhoneCall")
                        }, {
                            $set: {
                                sdp_caller: JSON.stringify(desc)
                            }
                        })

                    })

            }, function(err) {
                console.log(err);
            });
            /*   Meteor.call("videoCall/makeCall", {
                   id: Session.get("target-user"),
                   SDP: ""
               });*/
        },
        AnswerCall: function() {
            window.ringtone.pause();
            Session.set("phoneIsRinging", false);
            navigator.getWebcam = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
            navigator.getWebcam({
                video: true,
                audio: true
            }, function(stream) {
                let localVideo = document.getElementById("videoChatAnswerVideo");
                localVideo.src = window.URL.createObjectURL(stream);
                localVideo.muted = true;
                localVideo.play();
                if (!window.myPeerConnection)
                    VideoCallServices.CreatePeerConnection();
                window.myPeerConnection.onicecandidate = function(event) {
                    console.log(event.candidate);
                    if (event.candidate)
                        VideoChatCallLog.update({
                            _id: Session.get("currentPhoneCall")
                        }, {
                            $push: {
                                ice_callee: {
                                    candidate: event.candidate.candidate,
                                    sdpMid: event.candidate.sdpMid,
                                    sdpMLineIndex: event.candidate.sdpMLineIndex
                                }
                            }
                        })
                };
                window.myPeerConnection.onaddstream = function(event) {
                    console.log("STRAIM", event);
                    var video = document.getElementById("videoChatAnswerVideo");
                    video.src = URL.createObjectURL(event.stream);
                    video.play();
                };
                window.myPeerConnection.addStream(stream);
                let videoCallData = VideoChatCallLog.findOne({
                    _id: Session.get("currentPhoneCall")
                });
                console.log(Session.get("currentPhoneCall"));
                console.log(videoCallData);


            }, function(err) {});

        },
        CreatePeerConnection: function(caller) {
            let PeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection || window.msRTCPeerConnection || RTCPeerConnection;
            window.myPeerConnection = new PeerConnection([{
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
            }]);
        }
    };
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
                SDP_caller: data.sdp_caller,
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