(function () {
  var form = document.getElementById("contact-form");
  if (!form) return;
  var status = document.getElementById("cf-status");
  var button = form.querySelector("button[type=submit]");

  function setStatus(text, isError) {
    if (!status) return;
    status.textContent = text;
    status.hidden = false;
    status.classList.toggle("is-error", !!isError);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    button.disabled = true;
    button.textContent = "Pinging...";

    var data = Object.fromEntries(new FormData(form));

    fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data),
    })
      .then(function (res) { return res.json(); })
      .then(function (result) {
        if (result.success) {
          setStatus("핑이 전달됐습니다. 곧 응답할게요!", false);
          form.reset();
        } else {
          setStatus("전송에 실패했습니다. 잠시 후 다시 시도해주세요.", true);
        }
      })
      .catch(function () {
        setStatus("전송에 실패했습니다. 잠시 후 다시 시도해주세요.", true);
      })
      .finally(function () {
        button.disabled = false;
        button.textContent = "Ping";
      });
  });
})();
