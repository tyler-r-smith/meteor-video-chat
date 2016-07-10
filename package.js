Package.describe({
  name: 'elmarti:video-chat',
  version: '0.4.1',
  // Brief, one-line summary of the package.
  summary: 'Simple WebRTC Video Chat for your app.',
  // URL to the Git repository containing the source code for this package.
  git: 'https://github.com/elmarti/meteor-video-chat',
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.2.1');
  api.use('ecmascript');
  api.use("mizzao:user-status@0.6.6");
  api.use(['templating'], 'client');
  api.addFiles(['services/server.js', 'services/publish.js'], "server");
  api.addFiles(['template.js', 'services/client.js'], "client");
  api.export(['VideoChatCallLog', 'VideoCallServices', "renderCallTemplate"]);
});

Package.onTest(function(api) {
  api.use('ecmascript');
  api.use('tinytest');
  
  api.addFiles('video-chat-tests.js');
  api.export([]);
});
