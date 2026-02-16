// Versioned message shapes for signaling/control/stems.
const protocolVersion = '1.0.0';

const signalingMessages = {
  join: {
    type: 'join',
    room: 'string',
    client: 'string',
    token: 'optional string',
    capabilities: ['control', 'audio', 'video', 'stems']
  },
  offer: {
    type: 'offer',
    sdp: 'string'
  },
  answer: {
    type: 'answer',
    sdp: 'string'
  },
  ice: {
    type: 'ice',
    candidate: 'object'
  },
  controlGrant: {
    type: 'control-grant',
    targetWindow: 'string',
    scope: 'bounded-window',
    version: protocolVersion
  },
  controlRevoke: {
    type: 'control-revoke'
  }
};

const helperApi = {
  startControl: {
    targetWindowId: 'string'
  },
  stopControl: {},
  setTargetWindow: {
    windowId: 'string'
  },
  getFocusState: {}
};

const stemManifest = {
  version: protocolVersion,
  projectId: 'string',
  revision: 'string',
  stems: [
    {
      id: 'string',
      name: 'string',
      hash: 'sha256',
      url: 'string',
      lengthSeconds: 'number',
      sampleRate: 'number',
      channels: 'number',
      format: 'wav'
    }
  ]
};

module.exports = {
  protocolVersion,
  signalingMessages,
  helperApi,
  stemManifest
};
