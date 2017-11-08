/*
 * ng-face-tracker v0.0.1
 * (c) 2013 Saurabh619 http://unfoundbox.github.io
 * License: MIT
 */

'use strict';
angular.module('Saurabh619.ng-face-tracker', []);

directive('bbfFaceTracker', function($document, $compile, $rootScope) {
  /*
           ^                       ^
           |\   \        /        /|
          /  \  |\__  __/|       /  \
         / /\ \ \ _ \/ _ /      /    \
        / / /\ \ {*}\/{*}      /  / \ \
        | | | \ \( (00) )     /  // |\ \
        | | | |\ \(V""V)\    /  / | || \|
        | | | | \ |^--^| \  /  / || || ||
       / / /  | |( WWWW__ \/  /| || || ||
      | | | | | |  \______\  / / || || ||
      | | | / | | )|______\ ) | / | || ||
      / / /  / /  /______/   /| \ \ || ||
     / / /  / /  /\_____/  |/ /__\ \ \ \ \
     | | | / /  /\______/    \   \__| \ \ \
     | | | | | |\______ __    \_    \__|_| \
     | | ,___ /\______ _  _     \_       \  |
     | |/    /\_____  /    \      \__     \ |    /\
     |/ |   |\______ |      |        \___  \ |__/  \
     v  |   |\______ |      |            \___/     |
        |   |\______ |      |                    __/
         \   \________\_    _\               ____/
       __/   /\_____ __/   /   )\_,      _____/
      /  ___/  \uuuu/  ___/___)    \______/
      VVV  V        VVV  V
  */


  return {
    restrict: 'A',

    compile: function(element, attr) {
      var type = attr.type || 'text';
      var required = attr.hasOwnProperty('required') ? "required='required'" : "";
      var htmlText = '<video haar-face-tracker id="webcam" width="640" height="480" style="display:none;" src="blob:https://inspirit.github.io/4227dcb7-5b00-4a15-9ae9-5a41b4a24a55"></video>' +
        '<div style=" width:640px;height:480px;margin: 10px auto;">' +
        '<canvas id="canvas" width="640" height="480"></canvas>' +
        '<div id="no_rtc" class="alert alert-error" style="display:none;"></div>' +
        '<div id="log" class="alert alert-info"><strong>FPS: 14.85</strong><br>haar detector: 63ms</div>' +
        '</div></div>'
      element.replaceWith(htmlText);
    }

    return function(scope, elt, attr) {

      function tracker() {
        // lets do some fun
        var video = document.getElementById('webcam');
        var canvas = document.getElementById('canvas');
        try {
          var attempts = 0;
          var readyListener = function(event) {
            findVideoSize();
          };
          var findVideoSize = function() {
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              video.removeEventListener('loadeddata', readyListener);
              onDimensionsReady(video.videoWidth, video.videoHeight);
            } else {
              if (attempts < 10) {
                attempts++;
                setTimeout(findVideoSize, 200);
              } else {
                onDimensionsReady(640, 480);
              }
            }
          };
          var onDimensionsReady = function(width, height) {
            demo_app(width, height);
            compatibility.requestAnimationFrame(tick);
          };

          video.addEventListener('loadeddata', readyListener);

          compatibility.getUserMedia({
            video: true
          }, function(stream) {
            try {
              video.src = compatibility.URL.createObjectURL(stream);
            } catch (error) {
              video.src = stream;
            }
            setTimeout(function() {
              video.play();
            }, 500);
          }, function(error) {
            $('#canvas').hide();
            $('#log').hide();
            $('#no_rtc').html('<h4>WebRTC not available.</h4>');
            $('#no_rtc').show();
          });
        } catch (error) {
          $('#canvas').hide();
          $('#log').hide();
          $('#no_rtc').html('<h4>Something goes wrong...</h4>');
          $('#no_rtc').show();
        }
      }

      var stat = new profiler();

      var ctx, canvasWidth, canvasHeight;
      var img_u8, work_canvas, work_ctx;

      var max_work_size = 160;

      function demo_app(videoWidth, videoHeight) {
        canvasWidth = canvas.width;
        canvasHeight = canvas.height;
        ctx = canvas.getContext('2d');

        ctx.fillStyle = "rgb(0,255,0)";
        ctx.strokeStyle = "rgb(0,255,0)";

        var scale = Math.min(max_work_size / videoWidth, max_work_size / videoHeight);
        var w = (videoWidth * scale) | 0;
        var h = (videoHeight * scale) | 0;

        img_u8 = new jsfeat.matrix_t(w, h, jsfeat.U8_t | jsfeat.C1_t);
        work_canvas = document.createElement('canvas');
        work_canvas.width = w;
        work_canvas.height = h;
        work_ctx = work_canvas.getContext('2d');

        jsfeat.bbf.prepare_cascade(jsfeat.bbf.face_cascade);

        stat.add("bbf detector");
      }

      function tick() {
        compatibility.requestAnimationFrame(tick);
        stat.new_frame();
        if (video.readyState === video.HAVE_ENOUGH_DATA) {

          ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);

          work_ctx.drawImage(video, 0, 0, work_canvas.width, work_canvas.height);
          var imageData = work_ctx.getImageData(0, 0, work_canvas.width, work_canvas.height);

          stat.start("bbf detector");

          jsfeat.imgproc.grayscale(imageData.data, work_canvas.width, work_canvas.height, img_u8);

          // possible options
          //jsfeat.imgproc.equalize_histogram(img_u8, img_u8);

          var pyr = jsfeat.bbf.build_pyramid(img_u8, 24 * 2, 24 * 2, 4);

          var rects = jsfeat.bbf.detect(pyr, jsfeat.bbf.face_cascade);
          rects = jsfeat.bbf.group_rectangles(rects, 1);

          stat.stop("bbf detector");

          // draw only most confident one
          draw_faces(ctx, rects, canvasWidth / img_u8.cols, 1);

          $('#log').html(stat.log());
        }
      }

      function draw_faces(ctx, rects, sc, max) {
        var on = rects.length;
        if (on && max) {
          jsfeat.math.qsort(rects, 0, on - 1, function(a, b) {
            return (b.confidence < a.confidence);
          })
        }
        var n = max || on;
        n = Math.min(n, on);
        var r;
        for (var i = 0; i < n; ++i) {
          r = rects[i];
          ctx.strokeRect((r.x * sc) | 0, (r.y * sc) | 0, (r.width * sc) | 0, (r.height * sc) | 0);
        }
      }

      $(window).load(function() {
        tracker();
        $(window).unload(function() {
          video.pause();
          video.src = null;
        });
      });
    };
  }
};
});
