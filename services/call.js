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
        })
    };
}
else if (Meteor.isClient) {
    VideoCallServices = {
        Call: function(callee_id) {
            navigator.getWebcam = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia || navigator.mediaDevices.getUserMedia);
            navigator.getWebcam({
                video: true,
                audio: true
            }, function(stream) {
                let localVideo = document.getElementById("videoChatCallerVideo");
                localVideo.src = window.URL.createObjectURL(stream);
                localVideo.muted = true;
                localVideo.play();
                let PeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection || window.msRTCPeerConnection;
                let SessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription || window.msRTCSessionDescription;
                window.myPeerConnection = new PeerConnection([{
                    "url": "stun:1.google.com:19302"
                }, {
                    "url": "stun:stun1.1.google.com:19302"
                }, {
                    url: 'turn:192.158.29.39:3478?transport=udp',
                    credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
                    username: '28224511:1379330808'
                }]);
                window.myPeerConnection.onicecandidate = function(event) {
                    console.log(event);
                    if (event.candidate) {
                        console.log(new RTCIceCandidate(event.candidate));
                    }
                };
                window.myPeerConnection.addStream(stream);
                window.myPeerConnection.createOffer()
                    .done(function(desc) {
                        console.log(desc);

                        Meteor.call("videoCall/makeCall", {
                            id: callee_id,
                            sdp_caller: desc.sdp
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

            navigator.getWebcam = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
            navigator.getWebcam({
                video: true,
                audio: true
            }, function(stream) {
                let localVideo = document.getElementById("videoChatAnswerVideo");
                localVideo.src = window.URL.createObjectURL(stream);
                localVideo.muted = true;
                localVideo.play();
                let PeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection || window.msRTCPeerConnection || RTCPeerConnection;
                let SessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription || window.msRTCSessionDescription;
                let myPeerConnection = new PeerConnection([{
                    "url": "stun:1.google.com:19302"
                }, {
                    "url": "stun:stun1.1.google.com:19302"
                }, {
                    url: 'turn:192.158.29.39:3478?transport=udp',
                    credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
                    username: '28224511:1379330808'
                }]);
                console.log(myPeerConnection);
                myPeerConnection.onicecandidate = function(event) {
                    Meteor.call("videoCall/setCalleeIce", event.candidate);
                    console.log(event.candidate);
                };
                myPeerConnection.addStream(stream);
                console.log(myPeerConnection);
                let videoCallData = VideoChatCallLog.findOne({
                    _id: Session.get("currentPhoneCall")
                });
                console.log(videoCallData);
                myPeerConnection.setRemoteDescription(new RTCSessionDescription({
                        sdp: videoCallData.SDP_caller,
                        type: "offer"
                    }))
                    .done(function() {
                        myPeerConnection.createAnswer()
                            .done(function(answer) {
                                myPeerConnection.setLocalDescription(answer);
                                Meteor.call("videoCall/answered", {
                                    id: Session.get("currentPhoneCall"),
                                    sdp_callee: answer.sdp
                                }, function() {});
                            });
                    });


            }, function(err) {});

        }
    };
}





if (Meteor.isServer) {
    Meteor.methods({
        "videoCall/makeCall": function(data) {
            VideoChatCallLog.insert({
                caller_id: Meteor.userId(),
                call_dt: new Date().getTime(),
                conn_dt: "",
                call_start_dt: "",
                call_end_dt: "",
                status: "C",
                callee_id: data.id,
                SDP_caller: data.sdp_caller,
                SDP_callee: "",
                ice_caller: "",
                ice_callee: [],
                caller_con_result: "",
                callee_con_result: ""
            });
        },
        'videoCall/calleeRecieved': function(data) {
            VideoChatCallLog.update({
                _id: data.id
            }, {
                $set: {
                    conn_dt: new Date().getTime(),
                    status: "R",
                }
            })
        },
        'videoCall/answered': function(data) {
            VideoChatCallLog.update({
                _id: data.id
            }, {
                $set: {
                    call_start_dt: new Date().getTime(),
                    status: "A",
                }
            })
        },
        "videoCall/setCalleeIce": function(data) {
            VideoChatCallLog.update({
                _id: data.id
            }, {
                $push: {
                    ice_callee: {
                        ice: data.ice,
                        used: false
                    }
                }
            })
        }
    })
}