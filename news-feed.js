/* სექტორი.ge · მთავარი გვერდის სიახლეების ჩატვირთვა ადმინ პანელიდან.
   თუ სიახლეები ჯერ არ არის, გვერდზე სანიმუშო ბლოკები უცვლელი რჩება. */
(function () {
  function mkCard(m, i) {
    var a = document.createElement('a');
    a.className = 'card' + (i % 2 ? ' red' : '');
    a.href = '/news/' + encodeURIComponent(m.id);

    var ph = document.createElement('div');
    ph.className = 'ph';
    if (m.image) {
      var img = document.createElement('img');
      img.src = m.image;
      img.alt = m.title;
      img.loading = 'lazy';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover';
      ph.appendChild(img);
    }
    var body = document.createElement('div');
    body.className = 'body';
    var small = document.createElement('small');
    small.textContent = m.category;
    var h3 = document.createElement('h3');
    h3.textContent = m.title;
    body.appendChild(small);
    body.appendChild(h3);
    a.appendChild(ph);
    a.appendChild(body);
    return a;
  }

  function fill(container, list) {
    if (!container || !list.length) return;
    container.textContent = '';
    list.forEach(function (m, i) { container.appendChild(mkCard(m, i)); });
  }

  function hero(el, m) {
    if (!el || !m) return;
    el.textContent = '';
    var tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = m.category;
    var h2 = document.createElement('h2');
    var link = document.createElement('a');
    link.href = '/news/' + encodeURIComponent(m.id);
    link.textContent = m.title;
    h2.appendChild(link);
    el.appendChild(tag);
    el.appendChild(h2);
    if (m.excerpt) {
      var p = document.createElement('p');
      p.textContent = m.excerpt;
      el.appendChild(p);
    }
    if (m.image) {
      el.style.backgroundImage = 'linear-gradient(to top,rgba(11,13,12,.92),rgba(11,13,12,.15)),url("' + m.image + '")';
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
    }
  }

  fetch('/api/news?limit=12')
    .then(function (r) { return r.ok ? r.json() : { items: [] }; })
    .then(function (data) {
      var items = data.items || [];
      if (!items.length) return;

      var main = items.find(function (m) { return m.featured; }) || items[0];
      var rest = items.filter(function (m) { return m !== main; });

      hero(document.querySelector('#news .hero'), main);
      fill(document.querySelector('#news .grid2'), rest.slice(0, 2));
      var latest = document.querySelector('.sec.g .grid2');
      fill(latest, rest.slice(2, 8));

      if (latest && !document.getElementById('all-news-link')) {
        var p = document.createElement('p');
        p.id = 'all-news-link';
        p.style.cssText = 'margin:20px 0 0;font-weight:700';
        var a = document.createElement('a');
        a.href = '/news';
        a.textContent = 'ყველა სიახლე →';
        a.style.color = '#7bd9a1';
        p.appendChild(a);
        latest.parentNode.appendChild(p);
      }
    })
    .catch(function () { /* leave placeholders */ });
})();
