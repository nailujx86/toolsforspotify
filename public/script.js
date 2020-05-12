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

function getCookie(name) {
  var v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
  return v ? v[2] : null;
}

function setCookie(name, value, days) {
  var d = new Date;
  d.setTime(d.getTime() + 24 * 60 * 60 * 1000 * days);
  document.cookie = name + "=" + value + ";path=/;expires=" + d.toGMTString();
}

function deleteCookie(name) {
  setCookie(name, '', -1);
}

function setTheme(theme) {
  if(theme == "dark") {
    document.documentElement.classList.add("dark");
    setCookie('theme', 'dark', 999);
  } else {
    document.documentElement.classList.remove("dark");
    setCookie('theme', 'light', 999);
  }
  if(document.readyState == "interactive" || document.readyState == "complete")
    document.getElementById("toggle-theme").innerHTML = (theme == "dark" ? "☀" : "🌑");
}

var currentTheme = "light";

function toggleTheme() {
  if(currentTheme == "light") {
    setTheme("dark");
    currentTheme = "dark";
  }
  else {
    setTheme("light");
    currentTheme = "light";
  }
}

if(!getCookie('theme')){
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      currentTheme = "dark";
  } else {
      currentTheme = "light";
  }
} else {
  currentTheme = getCookie('theme');
}

window.addEventListener("load", function() {
  document.getElementById("toggle-theme").innerHTML = (currentTheme == "dark" ? "☀" : "🌑");
  document.documentElement.classList.add("animate");
});

setTheme(currentTheme);