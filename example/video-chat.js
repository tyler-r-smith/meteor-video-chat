if (Meteor.isServer) {
  Meteor.publish("userList", function() {
    return Meteor.users.find({
      "status.online": true
    }, {
      fields: {
        profile: 1,
        status: 1,
        emails: 1
      }
    });
  });
}
if (Meteor.isClient) {
  Template.body.onRendered(renderCallTemplate);
  Meteor.startup(function() {
    Meteor.VideoCallServices.onReceivePhoneCall = function() {
      Modal.show("incomingCall", {}, {
        backdrop: 'static'
      });
    }
    Meteor.VideoCallServices.onCallTerminated = function() {
      console.log(this);
      Modal.hide();
    }
    Meteor.VideoCallServices.onCallIgnored = function() {
      Modal.hide();
      alert("call ignored");
    }
    Meteor.VideoCallServices.onWebcamFail = function(error) {
      console.log("Failed to get webcam", error);
    }
    Meteor.VideoCallServices.elementName = "MeteorVideoChat";
    Meteor.VideoCallServices.STUNTURN = {
      "iceServers": [{
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
      }]

    };
    Meteor.VideoCallServices.setRingtone('/nokia.mp3');
  });


  Template.MeteorVideoChat.events({
    "click #answer": function() {
      Meteor.VideoCallServices.answerCall();
    },
    "click .userIDLink": function(event) {
      console.log(event.target.childNodes[0].data);
      let thisId = Meteor.users.findOne({
        "emails.address": event.target.childNodes[0].data
      })._id;
      Modal.show("chatModal", {
        callee: thisId,
        calleename: event.target.childNodes[0].data,
        isCaller: true
      }, {
        backdrop: 'static'
      })

    }
  });
  //{_id:{$ne:Meteor.userId()}}
  Template.MeteorVideoChat.helpers({
    getEmail: function() {
      console.log(this);
      return this.emails[0].address;
    },
    isntCurrentlyLoggedInUser: function() {
      return !(this._id == Meteor.userId());
    },
    getUsers: function() {
      return Meteor.users.find({
        
        "status.online": true
      }).fetch();
    },
    getStatus: function() {
      let callState = Session.get("callState");
      if (callState)
        return callState.message;
    }
  })
  Template.MeteorVideoChat.onRendered(function() {
    Meteor.subscribe("userList");


  })
  Template.chatModal.onCreated(function() {
    Meteor.VideoCallServices.setLocalWebcam("videoChatCallerVideo");
    Meteor.VideoCallServices.setRemoteWebcam("videoChatAnswerVideo");
  })
  Template.chatModal.onRendered(function() {

    let self = this;

    Meteor.VideoCallServices.loadLocalWebcam(true, function() {
      console.log("callback");
      Meteor.VideoCallServices.callRemote(self.data.callee)
    });


  })
  Template.chatModal.onDestroyed(function() {});

  Template.chatModal.events({
    "click #closeChat": function(event, template) {
      Meteor.VideoCallServices.callTerminated();
      Modal.hide(template);
    }
  })



  Template.incomingCall.onCreated(function() {
    Meteor.VideoCallServices.setLocalWebcam("videoChatCallerVideo");
    Meteor.VideoCallServices.setRemoteWebcam("videoChatAnswerVideo");
  })
  Template.incomingCall.helpers({
    getCallerName: function() {
      let callData = VideoChatCallLog.findOne({
        _id: Session.get("currentPhoneCall")
      });
      return Meteor.users.findOne({
        _id: callData.caller_id
      }).emails[0].address;
    },
    getStatus: function() {
      let callState = Session.get("callState");
      if (callState)
        return callState.message;
    }
  });
  Template.incomingCall.events({
    "click #answerCall": function(event, template) {
      Meteor.VideoCallServices.loadLocalWebcam(false, function() {
        Meteor.VideoCallServices.answerCall();
      });
    },
    "click #ignoreCall": function(event, template) {
      Meteor.VideoCallServices.ignoreCall();
      Modal.hide(template);
    },
    "click #closeChat": function(event, template) {
      Meteor.VideoCallServices.callTerminated();
      Modal.hide(template);
    }
  })
}