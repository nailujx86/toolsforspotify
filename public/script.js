function login() { // had to do that due to window.opener being cut off on mobile after origin redirects
  var child = window.open("/authorize?modern=true", "_blank");
  function closeCheck() {
    if(child.closed) {
      window.location.reload(true);
      clearInterval(checkInterval);
    }
  }
  var checkInterval = setInterval(closeCheck, 100);
}