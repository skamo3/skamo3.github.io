(function () {
  // 사이트 내부를 이동하는 동안 URL로 유지할 쿼리 파라미터 목록
  var PERSIST_PARAMS = ["company", "highlight"];

  var query = new URLSearchParams(window.location.search);
  var carried = PERSIST_PARAMS.filter(function (key) {
    return query.get(key);
  });
  if (!carried.length) return;

  // 회사 프로젝트 섹션 표시 (홈에만 존재)
  if (query.get("company") === "1") {
    document.querySelectorAll("[data-company-projects]").forEach(function (section) {
      section.hidden = false;
    });
  }

  // 사이트 내부 링크 클릭 시 쿼리를 이어붙여 이동 후에도 상태가 유지되게 한다.
  // 저장소 없이 URL로만 전파하므로 쿼리 없이 접속하면 항상 기본 상태다.
  document.addEventListener(
    "click",
    function (e) {
      var link = e.target.closest("a[href]");
      if (!link) return;
      if (link.origin !== location.origin) return;
      var href = link.getAttribute("href");
      if (!href || href.charAt(0) === "#") return;
      var qs = new URLSearchParams(link.search);
      var changed = false;
      carried.forEach(function (key) {
        if (!qs.has(key)) {
          qs.set(key, query.get(key));
          changed = true;
        }
      });
      if (changed) link.search = qs.toString();
    },
    true // capture: 모달 등 다른 클릭 핸들러가 href를 읽기 전에 실행
  );
})();
