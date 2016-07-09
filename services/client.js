  VideoCallServices = new class {
    constructor() {
        this.peerConnection = {};
        this.STUNTURN = null;
        this.connectionRetryLimit = 10;
        this.VideoChatCallLog = new Meteor.Collection("VideoChatCallLog");
      }
      //The following 3 functions are events which can be overriden
    onReceivePhoneCall() {

    }
    onCallTerminated() {

    }
    onCallIgnored() {

    }
    onWebcamFail() {

    }
    onStateChange() {

      }
      /*
       *   Terminate the call, if the call was successful, it will be populated with the userId of the terminator. 
       *
       */
    callTerminated() {
        if (Session.get("currentPhoneCall")) {
          let thisCall = this.VideoChatCallLog.findOne({
            _id: Session.get("currentPhoneCall")
          });
          if (thisCall.status == "CON")
            this.VideoChatCallLog.update({
              _id: Session.get("currentPhoneCall")
            }, {
              $set: {
                status: Meteor.userId(),
                call_end_dt: new Date().getTime()
              }
            })
          else if (thisCall.status == "R" || thisCall.status == "IRS" || thisCall.status == "A")
            if (Meteor.userId() == thisCall.callee_id) {
              Meteor.VideoCallServices.stopRingtone();
              this.VideoChatCallLog.update({
                _id: Session.get("currentPhoneCall")
              }, {
                $set: {
                  status: "D"
                }
              })
            }
            else {
              this.VideoChatCallLog.update({
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
            Meteor.localStream.getTracks().forEach(function(thisTrack) {
              thisTrack.stop();
            });
          }
          catch (e) {}
          Meteor.VideoCallServices.peerConnection = {};
        }

        Session.set("currentPhoneCall", null);
        Session.set("remoteIceCandidates", []);
        Session.set("callState", null);
        this.stopRingtone();
        this.onCallTerminated();
      }
      /*
       *   Get the local webcam stream, using a polyfill for cross-browser compatibility
       *
       */
    _getWebcam(loadPeer, callback) {
        let handleStream = function(stream) {
          console.log("handleStream")
          if (loadPeer)
            Meteor.VideoCallServices._loadRTCConnection();
          Meteor.localStream = stream;
          Meteor.VideoCallServices.peerConnection.addStream(Meteor.localStream);
          return callback(stream);
        };
        if (navigator.mediaDevices) {
          console.log("new type");
          navigator.mediaDevices.getUserMedia({
              video: true,
              audio: true
            })
            .then(handleStream)
            .catch(function(err) {
              Meteor.VideoCallServices.onWebcamFail(err);
            });
        }
        else {
          navigator.getUserMedia = (navigator.getUserMedia ||
            navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia);
          navigator.getUserMedia({
            video: true,
            audio: true
          }, handleStream, function(err, dave) {
            console.log("failed", err, dave)
          });
        }
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
      this._getWebcam(loadPeer, (stream) => {
        if (localVideoHTMLId) {
          let localVideo = document.getElementById(localVideoHTMLId);
          localVideo.src = URL.createObjectURL(stream);
          localVideo.muted = true;
          localVideo.play();
        }
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
        window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection ||
          window.webkitRTCPeerConnection || window.msRTCPeerConnection;


        this.peerConnection = new RTCPeerConnection(this.STUNTURN);
      }
      /*
       *   Create the local SDP offer and insert it into the database
       *
       */
    _createLocalOffer() {
        let self = this;
        Meteor.VideoCallServices.peerConnection.createOffer(function(desc) {
          console.log("createOffer", desc);
          console.log(Session.get("currentPhoneCall"));
          console.log(self.VideoChatCallLog.update({
            _id: Session.get("currentPhoneCall")
          }, {
            $set: {
              SDP_caller: JSON.stringify(desc)
            }
          }))
          Meteor.VideoCallServices.peerConnection.setLocalDescription(desc);

        }, function(err) {
          if (err) console.log(err)
        });
      }
      /**
       * Set up the event handlers for the caller
       *
       */
    _setUpCallerEvents() {
        let self = this;
        this.peerConnection.oniceconnectionstatechange = function(event) {
          console.log("Ice state change", Meteor.VideoCallServices.peerConnection.iceConnectionState);
          let pc = Meteor.VideoCallServices.peerConnection;
          if (pc.iceConnectionState == "failed") {
            let currentSession = self.VideoChatCallLog.findOne({
              _id: Session.get("currentPhoneCall")
            });
            if (currentSession.connection_retry_count <= Meteor.VideoCallServices.connectionRetryLimit) {
              self.VideoChatCallLog.update({
                _id: Session.get("currentPhoneCall")
              }, {
                $set: {
                  status: "IF",
                  ice_caller: [],
                  ice_callee: []
                },

                $inc: {
                  connection_retry_count: 1
                }
              })
            }
            else
              self.VideoChatCallLog.update({
                _id: Session.get("currentPhoneCall")
              }, {
                $set: {
                  status: "F"
                }
              });
          }
          else if (pc.iceConnectionState == "connected") {
            let thisCall = self.VideoChatCallLog.findOne({
              _id: Session.get("currentPhoneCall")
            });
            Session.set("callState", {
              message: "Call successful",
              status: "CON",
              timestamp: new Date(),
              caller: thisCall.caller_id,
              callee: thisCall.callee_id
            })
            self.VideoChatCallLog.update({
              _id: Session.get("currentPhoneCall")
            }, {
              $set: {
                status: "CON",
                call_suc_dt: new Date()
              }
            })
          }

          console.log("iceChange");
        }
        this.peerConnection.onicecandidate = function(event) {
          console.log(event.candidate);
          if (event.candidate)
            self.VideoChatCallLog.update({
              _id: Session.get("currentPhoneCall")
            }, {
              $set: {
                ice_caller: JSON.stringify(event.candidate)
              }
            })
          else
            self.VideoChatCallLog.update({
              _id: Session.get("currentPhoneCall")
            }, {
              $unset: {
                ice_caller: ""
              }
            })
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
        let self = this;
        this.peerConnection.onicecandidate = function(event) {
          console.log(event.candidate);
          if (event.candidate)
            self.VideoChatCallLog.update({
              _id: Session.get("currentPhoneCall")
            }, {
              $set: {
                ice_callee: JSON.stringify(event.candidate)

              }
            })
          else
            self.VideoChatCallLog.update({
              _id: Session.get("currentPhoneCall")
            }, {
              $unset: {
                ice_callee: ""
              }
            })


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
        try {
          let newCall = this.VideoChatCallLog.insert({
            caller_id: Meteor.userId(),
            call_dt: new Date().getTime(),
            conn_dt: "",
            call_start_dt: "",
            call_suc_dt: "",
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
          })
          Session.set("currentPhoneCall", newCall)
        }
        catch (err) {
          console.log(err);
        }

      }
      /*
       *   Answer the call and set up WebRTC
       *
       */
    answerCall(events) {
        this.stopRingtone();
        this.VideoChatCallLog.update({
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
      this.VideoChatCallLog.update({
        _id: Session.get("currentPhoneCall")
      }, {
        $set: {
          status: "IG"
        }
      })
    }
  };
  Meteor.VideoCallServices = VideoCallServices;