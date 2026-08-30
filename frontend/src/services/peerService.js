import Peer from 'peerjs';

let peer = null;

export const initPeer = (userId) => {
    // Using default public PeerJS server for dev
    peer = new Peer(userId);

    peer.on('open', (id) => {
        console.log('My peer ID is: ' + id);
    });

    return peer;
};

export const callPeer = (remotePeerId, localStream) => {
    if (!peer) return null;
    return peer.call(remotePeerId, localStream);
};

export const destroyPeer = () => {
    if (peer) {
        peer.destroy();
        peer = null;
    }
};
