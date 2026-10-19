(function () {
  var btn = document.getElementById('copy-phone');
  var phone = document.getElementById('phone');
  if (!btn || !phone) return;
  btn.addEventListener('click', function () {
    var text = phone.textContent.trim();
    function done() { btn.textContent = 'Номер скопирован'; setTimeout(function () { btn.textContent = 'Скопировать номер'; }, 2000); }
    function fallback() {
      var r = document.createRange(); r.selectNodeContents(phone);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      btn.textContent = 'Номер выделен';
    }
    try {
      navigator.clipboard.writeText(text).then(done, fallback);
    } catch (e) { fallback(); }
  });
})();
