/**
 * Camera Module
 * Gestisce l'accesso alla fotocamera e i controlli (torcia, zoom, focus)
 */

var Camera = (function() {
  'use strict';

  var videoElement = null;
  var stream = null;
  var track = null;
  var isTorchOn = false;
  var isInitialized = false;

  /**
   * Inizializza la fotocamera
   */
  function init(videoId) {
    videoElement = document.getElementById(videoId);
    isInitialized = true;
  }

  /**
   * Avvia la fotocamera posteriore
   */
  function start() {
    return new Promise(function(resolve, reject) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        reject(new Error('getUserMedia non supportato'));
        return;
      }

      var constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 }
        },
        audio: false
      };

      navigator.mediaDevices.getUserMedia(constraints)
        .then(function(mediaStream) {
          stream = mediaStream;
          if (videoElement) {
            videoElement.srcObject = mediaStream;
            videoElement.style.display = 'block';
          }

          var tracks = mediaStream.getVideoTracks();
          if (tracks.length > 0) {
            track = tracks[0];
          }

          resolve({
            stream: mediaStream,
            track: track,
            hasTorch: hasTorch(),
            hasZoom: hasZoom()
          });
        })
        .catch(function(err) {
          console.error('Errore fotocamera:', err);
          reject(err);
        });
    });
  }

  /**
   * Ferma la fotocamera
   */
  function stop() {
    if (stream) {
      var tracks = stream.getTracks();
      for (var i = 0; i < tracks.length; i++) {
        tracks[i].stop();
      }
      stream = null;
    }

    if (videoElement) {
      videoElement.srcObject = null;
      videoElement.style.display = 'none';
    }

    track = null;
    isTorchOn = false;
  }

  /**
   * Verifica se la torcia e supportata
   */
  function hasTorch() {
    if (!track) return false;
    var capabilities = track.getCapabilities();
    return capabilities && capabilities.torch === true;
  }

  /**
   * Verifica se lo zoom e supportato
   */
  function hasZoom() {
    if (!track) return false;
    var capabilities = track.getCapabilities();
    return capabilities && capabilities.zoom;
  }

  /**
   * Attiva/disattiva torcia
   */
  function toggleTorch() {
    return new Promise(function(resolve, reject) {
      if (!track || !hasTorch()) {
        reject(new Error('Torcia non supportata'));
        return;
      }

      isTorchOn = !isTorchOn;

      track.applyConstraints({
        advanced: [{ torch: isTorchOn }]
      }).then(function() {
        resolve(isTorchOn);
      }).catch(function(err) {
        isTorchOn = !isTorchOn;
        reject(err);
      });
    });
  }

  /**
   * Imposta lo zoom
   */
  function setZoom(value) {
    return new Promise(function(resolve, reject) {
      if (!track || !hasZoom()) {
        reject(new Error('Zoom non supportato'));
        return;
      }

      var capabilities = track.getCapabilities();
      var min = capabilities.zoom.min || 1;
      var max = capabilities.zoom.max || 10;
      var zoomValue = Math.max(min, Math.min(max, value));

      track.applyConstraints({
        advanced: [{ zoom: zoomValue }]
      }).then(function() {
        resolve(zoomValue);
      }).catch(reject);
    });
  }

  /**
   * Cattura un frame come DataURL
   */
  function captureFrame() {
    if (!videoElement || !videoElement.videoWidth) return null;

    var canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', 0.9);
  }

  /**
   * Verifica se la fotocamera e attiva
   */
  function isActive() {
    return stream !== null && stream.active;
  }

  /**
   * Ottieni info sulle capacita
   */
  function getCapabilities() {
    if (!track) return {};
    return track.getCapabilities() || {};
  }

  // API pubblica
  return {
    init: init,
    start: start,
    stop: stop,
    hasTorch: hasTorch,
    hasZoom: hasZoom,
    toggleTorch: toggleTorch,
    setZoom: setZoom,
    captureFrame: captureFrame,
    isActive: isActive,
    getCapabilities: getCapabilities
  };
})();
