# Meteor Video Chat

This is a complete solution to allow you to create a peer2peer video chat system using DDP as the handshake protocol . 

## Warning

This package is under daily development and is currently volatile, it is possibly that certain functionality could become nonfunctional in the coming weeks, so click watch on the github page (give a star if you like :)) and I will update the changelog in this readme with any major changes. 

If you detect any errors or can suggest changes/features, ask me here [https://github.com/elmarti/meteor-video-chat/issues](https://github.com/elmarti/meteor-video-chat/issues)

## TO USE WEBRTC IN CHROME YOUR SERVER MUST HAVE A SECURE ORIGIN (SSL)
Find out more about using WebRTC on Chrome here:
[https://developers.google.com/web/updates/2015/10/chrome-47-webrtc](https://developers.google.com/web/updates/2015/10/chrome-47-webrtc) 
Find out more about browser compatibility here:  [http://iswebrtcreadyyet.com/](http://iswebrtcreadyyet.com/)


## Configuration
Before making a call you must initialize the HTML id of the `<video>` elements that you would like to send the streams to like so: 

      Meteor.VideoCallServices.setLocalWebcam("videoChatCallerVideo");
      Meteor.VideoCallServices.setRemoteWebcam("videoChatAnswerVideo");
      
You must also specify STUN and TURN servers. Here is a list of STUN/TURN servers, be careful because some havent given explicit permission to use them https://gist.github.com/yetithefoot/7592580
See more about setting you own STUN and TURN servers here: https://www.webrtc-experiment.com/docs/TURN-server-installation-guide.html http://www.stunprotocol.org/

      Meteor.VideoCallServices.STUNTURN = {"iceServers":[
                                        {url:"stun:stun.example.com"},
                                        {url: "turn:example.com",
                                        credentional: "dave",
                                        username:"test@dave.com"}]};
      
This could be done as you are making the call, in `Meteor.startup` or wherever you see fit.

If you like, you can set a ringtone, which will play on loop when a call is received:

    Meteor.VideoCallServices.setRingtone('/aRingtone.mp3');

## Events
Initialize events in the client-side Meteor.startup.

     Meteor.VideoCallServices.onReceivePhoneCall = function(){
    	     //Code to be executed when a call is received
        }
     Meteor.VideoCallServices.onCallTerminated = function(){
		     //Code to be executed when the call has been ended by either user. 
	    }
	 Meteor.VideoCallServices.onCallIgnored = function(){
		     //Code to be executed when the call has been ended by either user. 
	    }
	    

## Making a Call

If you are initializing the webcam and making a call in the same function block, it is best to call the `callRemote()` function from within the `loadLocalWebcam()` callback like so: 

    Meteor.VideoCallServices.loadLocalWebcam(true, function() {
      Meteor.VideoCallServices.callRemote(**meteor _id of the user you are calling**)
    });
    
The first parameter specifies whether you would like to set up the peer connection, as this is called automatically by receiving a call. 

    Meteor.VideoCallServices.loadLocalWebcam(false, callback);
    
Regardless of how you initialise it, the webcam stream will be available on Meteor.localStream
    
## Receiving a phone call
A number of things happen when you receive a phone call: `onReceivePhoneCall()` function is called and the, if you set a ringtone, it will be set to play, a helper called "incomingPhoneCall" will be set to true and so will a session variable called "phoneIsRinging". 

To answer a call, like before you must initialize the peer connection and webcam and then call the `answerCall()`function. The first parameter must be false. 

        Meteor.VideoCallServices.loadLocalWebcam(false, function() {
	        Meteor.VideoCallServices.answerCall()
	    });
Answer call stops the ringtone, sets the aforementioned helper/session variables to false and directs the caller and callee video streams to the appropriate `<video>` elements. 

## Ending a call
To end a call simply call the following function: 

    Meteor.VideoCallServices.callTerminated();
This will call the same function for both users, which will be followed by the "onCallTerminated" event. 

## TODO
 1. Improve error handling of connection process, handle ICE failure
 2. Detect network latency and handle reconnect if necessary
 3. Add option to continue with only audio if latency is too high

## Changelog
 - 16:15GMT 23/03/2016 Version 0.2.3 Removed hardcoded STUN/TURN servers, to be initialized on startup
 - 05:38GMT 23/03/2016 Version 0.2.2 Added call ignore function and onCallIgnored event
 - 04:08GMT 23/03/2016 version 0.2.1 Program is no longer called from window, but Meteor instead, as per usual development style
 - 01:10GMT 23/03/2016 version 0.1.7 Fixed and tested connection issues. Used for call from UK to China.
 - 16:03GMT 20/03/2016 version 0.1.5 Serious refactoring of connection process to decouple ICE exhange from call acceptance process. Additional parameter in loadLocalWebcam function to allow the user to specify whether they would like the function to initialize the RTCSession
 - 10:52GMT 20/03/2016 version 0.1.0 published