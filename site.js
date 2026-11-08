/* NUIKA — chrome shared by every page of the new site.
 *
 * The header and the footer are built here and nowhere else. There is no
 * second copy, so no page can drift out of sync with a stale menu.
 *
 * A page opts in by placing an empty element:
 *     <header data-nuika-header="story"></header>
 *     <footer data-nuika-footer></footer>
 * The attribute's value marks which menu item is the current page.
 */

(function () {
  'use strict';

  /* Every value below reaches innerHTML, so every value below goes through
     esc(). These are hardcoded today; if they ever become admin-editable,
     esc() stops an attribute breakout but NOT a javascript: URL — that would
     need the scheme checked as well. */
  var NAV = [
    { key: 'shop',    href: './shop.html',    he: 'תפריט והזמנות', en: 'Menu & orders' },
    { key: 'story',   href: './story.html',   he: 'האג\'נדה',  en: 'Agenda' },
    { key: 'gallery', href: './gallery.html', he: 'גלריה',     en: 'Gallery' },
    { key: 'events',  href: './events.html',  he: 'פופ-אפים',  en: 'Pop-ups' },
    { key: 'contact', href: './contact.html', he: 'דברו איתי', en: 'Talk to me' }
  ];

  /* The places to find Noy, as marks rather than words.

     Each entry carries its own glyph. An icon with no text needs an
     accessible name or it reaches a screen reader as "link", so `he`/`en`
     stay — they are now the aria-label instead of the visible label.

     FACEBOOK: asked for on 22 Sep 2026, then set aside the same day — NUIKA
     has no Facebook address anywhere in this repo, and Shahar's answer when
     asked for one was that it is not relevant for now. If that changes it is
     one entry in this array and it appears on all five pages at once;
     nothing else needs touching. */
  var SOCIAL = [
    {
      href: 'https://www.instagram.com/nuika_bread/',
      he: 'אינסטגרם', en: 'Instagram',
      icon: '<rect x="2" y="2" width="20" height="20" rx="5.5"/>' +
            '<circle cx="12" cy="12" r="4.2"/>' +
            '<circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none"/>'
    },
    {
      href: 'https://wa.me/972547382282',
      he: 'וואטסאפ', en: 'WhatsApp',
      icon: '<path d="M20.5 11.6a8.4 8.4 0 0 1-12.4 7.4L3.5 20.5l1.6-4.5a8.4 8.4 0 1 1 15.4-4.4Z"/>' +
            '<path d="M9.2 8.4c.2-.5.4-.5.7-.5h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2 0 .4-.1.5l-.5.6c-.1.2-.2.3-.1.5a6 6 0 0 0 3 2.9c.2.1.4 0 .5-.1l.5-.6c.2-.2.3-.2.5-.1l1.8.9c.2.1.4.2.4.4a1.9 1.9 0 0 1-1.3 1.6 3.4 3.4 0 0 1-2.5-.3 10 10 0 0 1-4.7-4.4 3.7 3.7 0 0 1-.8-2.1c0-.7.3-1.3.7-1.6Z"/>'
    }
  ];

  /* Street address and pickup day, in one place. It used to say only
     "רחובות", which is a town, not somewhere a customer can drive to. */
  var PLACE = {
    he: 'ש. בן ציון 13, רחובות · איסוף בימי שישי',
    en: 'S. Ben Zion 13, Rehovot · Friday pickup'
  };

  /* Baobab Web Studio's credit, the last line of every footer. The mark is
     drawn inline (currentColor), so the line loads nothing, needs no font and
     tracks nothing; it takes the footer's own colour. Spec: the SiteCredit
     component in Baobab's brand book. No link yet — when baobab.co.il is live,
     wrap the <p> in <a href="https://baobab.co.il" rel="noopener">. These are
     constants of ours, never user input, so they go to innerHTML whole. */
  var BAOBAB_TREE = 'M1028.6 163.9C1027.7 167.9 1025.8 174.7 1026.9 178.9C1016.2 174.5 1004 176.2 991.9 175.5C987.6 175.3 983.4 173.4 979.1 174.1C969.3 175.8 949.6 186.1 944.9 194.1C930.9 173.4 885 187 877.6 207.1C869.9 197.3 855.2 196.3 844.6 194.1C843.3 199 840 206 839.6 210.9C831.6 204 817.1 208 807.9 207.1C807.1 210.6 804.4 215.9 803.9 219.4C797.8 215.7 787.2 217.7 781.1 218.1C782.2 221.3 782.9 228.2 783.9 231.1C768.4 225.7 754.3 233.8 740.4 237.6C745.2 243.8 748.9 252.9 755.6 257.9C749.9 257.3 738.6 257.5 733.6 260.6C728.9 242.8 702.7 254 692.4 260.4C691.4 254.1 686.8 247 684.1 241.1C671.9 245.1 657.6 243.5 649.1 256.4C647.7 252.7 643.6 248.4 641.6 244.6C633.3 248.7 609.9 249.8 602.4 267.9C594.6 257.9 578.9 257.8 568.6 255.1C567.7 259.9 563.9 266.3 564.4 271.6C559.6 269.4 537 264.8 532 268.8C529.5 270.7 527.6 278.2 527.1 280.6C521.2 277.1 511.7 279 505.4 279.1C507 282.7 506.9 288.9 508.9 292.1C494.5 287.6 476.9 294.3 464.4 299.6C469.6 306.5 473.8 314.6 481.6 319.6C459.3 317.5 448.2 326.6 434.4 342.4C442.4 345.8 451.5 350.6 460.6 350.6C457.6 354.5 457.3 361.7 455.9 365.6C459.2 365.5 464.4 367.1 468.4 367.5C484 369.2 497.8 361.2 509.9 353.9C508 360.6 508.8 369.7 509.4 376.6C516.1 374.8 522.9 380 528.1 382.6C524.5 383.3 519.8 386.1 515.6 387.2C501.4 391.3 488.4 392.4 478.1 404.1C477.7 400.2 473.9 396.1 472.6 392.4C462.4 396.6 440.5 397.9 432.4 414.9C423.5 404 409.3 405 398.4 401.1C397.5 406 393.8 412.4 393.4 417.1C388.6 415.2 366.7 412.1 362.2 415.4C359.5 417.3 357.8 424.9 357.4 427.4C351.4 423.8 341.7 425.9 335.4 426.1C336.6 429.4 336.9 435.8 337.6 438.6C324.3 432.4 306.1 442.2 294.1 445.9C299.8 452.6 303.9 461.2 311.9 466.6C288.2 465 278.9 471.6 264.1 488.9C271.9 491 281.5 497.6 290.1 496.9C288.4 500.6 287.1 507.7 286.1 512.1C309 512.8 318.9 516 339.4 500.1C337.7 507 339.7 516.2 338.4 523.1C354.2 523.9 376.9 523.5 388.6 509.6C393.1 517.9 420.8 530.9 430.9 528.4C435.4 527.3 443 518.8 444.9 515.4C448.9 523.5 459.4 532.1 466.6 538.3C487.7 556.6 513.2 569.3 541.4 570.9C549.8 571.3 558.9 570.2 567.1 571.7C576.3 573.4 601 593.5 639.1 598.5C708.5 607.5 790.2 589.2 848.6 637.9C902.1 682.4 875.8 731.9 858.5 785.9C822.7 898 809.2 1018.4 813.4 1135.9C815 1179.5 817.8 1222.7 822.3 1266.1C823.7 1279.1 828.8 1324.2 825.6 1334.4C848.8 1333.2 875.2 1334.9 899.4 1334.9C959.5 1334.9 1019.7 1334.9 1079.9 1334.9C1102.6 1334.9 1209.7 1332.5 1222.4 1334.6C1218.9 1322.9 1224.7 1276.9 1226.4 1262.6C1231.4 1222.4 1233.6 1181.8 1234.8 1141.4C1238.5 1020.9 1226.2 898.3 1188.9 783.4C1171.3 729.1 1145.8 680.4 1200.1 636.1C1255 591.3 1328.8 607.2 1393.6 597.7C1406.1 595.9 1418.6 592.8 1430.4 588.3C1437.7 585.5 1455.7 574.1 1461.4 573.7C1469.8 573.1 1478.9 575.7 1487.4 576.1C1521.8 577.5 1556.2 568.6 1582.9 546.1C1590.9 539.4 1602.7 529.1 1607.4 520.4C1619.1 537.9 1656.3 518.9 1659.4 509.9C1672.6 522.8 1693.9 523.9 1710.6 523.1C1708.8 516.9 1711.4 507.3 1709.4 501.1C1722.4 506.6 1733.6 515.1 1749.4 513.9C1753.9 513.6 1759.7 511.4 1763.6 511.6C1761.7 507.5 1761.6 501 1757.9 497.6C1766.4 495.7 1775.8 491.5 1784.1 488.1C1767.5 471.1 1762.1 466.3 1737.6 465.9C1745.6 461 1749.2 452.4 1754.6 445.9C1744.1 441.9 1723 433 1711.1 439.1C1711.9 436.1 1712.1 429.6 1713.4 426.1C1707.2 426.1 1697.3 424 1690.9 427.4C1690.7 425.1 1689.2 417.3 1686.7 415.3C1682.3 411.8 1659.6 415.4 1654.6 417.1C1654.6 412.4 1650.8 406.3 1649.9 401.4C1639.2 404.3 1625.4 404.6 1616.9 414.4C1606.3 397.7 1587.9 396.6 1576.1 392.1C1574.5 395.4 1570.9 399.2 1570.4 402.6C1565.6 396.8 1553.2 391.1 1546.4 389.4C1550.6 387.2 1556.5 383 1557.1 377.6C1568.7 391.8 1591.5 387.2 1602.9 389.4C1603.3 382.4 1603.4 372.6 1602.4 365.6C1624.9 383 1634.4 377.9 1657.1 377.4C1655.1 373.3 1654.8 366.4 1652.1 362.6C1660.2 361.3 1670.7 356.8 1678.4 354.4C1676.5 352.4 1675 348.8 1672.8 346.4C1661.2 333.9 1646 331.1 1630.6 331.6C1638.8 326.7 1641.9 318 1646.9 311.1C1634.2 307.2 1617.3 297.9 1603.1 304.1C1604.5 300.8 1604.7 294.8 1606.1 291.4C1600.1 291 1589.4 289.6 1583.6 293.4C1583 289.7 1580.4 284.3 1579.9 280.4C1571 280.8 1556.3 277.9 1548.1 283.6C1547.2 278.8 1543.5 272.2 1542.1 267.4C1532.1 271.2 1516.6 269.7 1509.1 280.1C1503.7 264.8 1479.5 262.1 1470.4 257.6C1468 261.4 1463.6 265.4 1462.9 269.9C1458.6 264.3 1434.4 250.8 1426.8 255.4C1423.4 257.4 1422.4 262.4 1421.4 265.9C1420.4 269.2 1419 274.2 1419.1 276.6C1406.2 265.1 1391.9 268.8 1382.6 266.4C1381.3 271.1 1377.2 277.4 1376.1 282.1C1374.9 281 1371.1 279 1369.6 278.4C1371.8 277.5 1375 274.8 1377.6 274.6C1364.2 256.6 1350.9 252.4 1329.4 252.6C1337.9 248.1 1341.3 239.3 1346.1 232.4C1335 229.4 1315.5 218.7 1301.9 225.6C1303.4 222 1303.6 215.8 1304.6 212.4C1298.6 212.1 1287.6 210.5 1281.6 214.1C1281.4 210.2 1278.9 205 1277.6 201.1C1268.3 203.8 1254.2 198.9 1245.4 205.6C1245.2 200.5 1242.1 193.6 1241.4 188.4C1231 190.5 1215 191.7 1207.6 201.9C1199.7 184.3 1180.2 184.6 1170.4 179.1C1169.6 179.9 1167.4 180.9 1166.9 181.4C1167.6 179.6 1167.2 177.3 1167.9 175.6C1160 175.2 1148.4 175.3 1140.6 178.9C1140.9 156.1 1103.5 170 1095.6 180.1C1085.5 167.4 1069.4 167.6 1054.6 166C1049.6 165.4 1045.1 163.3 1039.9 163.2C1036.2 163 1031.9 164.2 1028.6 163.9ZM678.6 555.4C669.7 555.6 658.8 557.2 648.9 556.8C606.1 555.4 569.7 534 546.4 499.4C561.6 507.9 577.1 510.4 593.6 512.6C594.2 509.8 597 506.7 597.4 503.9C605.2 508.8 616.3 507.8 624.4 509.6C624.2 505.4 626.1 499.1 626.6 495.1C630.8 497.4 637.5 493.5 641.8 496.5C664.3 512.5 668.3 538.8 678.6 555.4ZM1405.1 443.9C1406.1 445.1 1415 454.2 1416.6 455.4C1402.1 458.6 1398.2 461.7 1385.9 468.1C1388.7 470.1 1392.2 475.4 1395.6 477.1C1392.1 479.6 1390.5 485.5 1388.1 488.6C1396.5 492.7 1410.7 499.9 1420.6 495.9C1420.8 499.5 1422.8 506.1 1422.1 509.9C1430.2 509.1 1444.2 510.4 1451.1 504.4C1451.8 506.6 1454.7 509.9 1455.4 512.6C1460.7 511.5 1471.2 511.1 1476.4 511.6C1433.8 555.8 1399.4 558.7 1340.9 554C1332.7 553.3 1323.2 551.3 1315.9 551.1C1338.9 530.4 1359.9 484.2 1369.9 454.9C1375.1 458.3 1385.1 456.9 1390.6 459.9C1394 453.9 1401.4 449.5 1405.1 443.9ZM1261.6 430.6C1261.6 433.7 1264.2 438.4 1263.4 441.6C1276.3 442.9 1289.5 440.4 1301.6 435.1C1290.1 458.6 1307.2 501.6 1300.4 511.9C1293.3 522.4 1259 546.9 1246.6 550.6C1233 554.5 1217.8 554.8 1203.9 558.4C1171.4 566.9 1136.4 582.3 1110.4 603.1C1110.9 599.1 1109.6 593.1 1109.8 588.4C1110.4 566.9 1117 545.4 1129.4 527.6C1148.8 500 1179.1 493.4 1206.4 478.2C1228 466.2 1245.2 448 1261.6 430.6ZM636.9 412.9C643.1 424.2 664.2 439.4 678.6 434.7C682.4 433.4 683.9 429.2 687.2 427.1C690.1 425.2 694.7 424.3 696.6 421.9C698 423.7 700.9 425.4 702.8 427.3C711.1 435.5 711.4 433.8 722.1 431.5C724.6 430.9 728.6 430.8 730.4 429.9C749.4 460.5 785.4 483.6 820.4 492C828.8 494 859.6 495.8 863.3 497.5C868.9 500.2 883.2 521.4 888.6 527.4C919.1 561 934.9 565.7 943.1 612.6C909 576.7 840.8 555.2 791.9 551.3C777.8 550.2 733.1 552.9 724.9 549.9C707.6 543.8 685.9 503.1 669.6 489.9C682.6 486.9 687.7 480.4 697.4 472.9C693.6 470.5 689.2 466.1 684.4 463.7C673 457.8 639.7 448.3 627.6 447.6C630.3 443.2 628.6 436.3 629.9 431.6C626.6 431.5 620 430.1 616.4 431.6C615.8 429.1 613.1 423.2 611.4 421.4C618.2 419.9 631.7 417.9 636.9 412.9ZM972.4 401.6C977.4 409.1 1004.4 420.6 1013.6 418C1018.6 416.6 1024.4 408.8 1026.6 404.9C1029.9 424.9 1036.4 447.2 1048.7 464.4C1054.9 473 1074 491.8 1073.7 502.1C1073.3 514.4 1059 527.3 1051.6 535.9C1039.4 550.1 1027.8 569.1 1022.4 586.4C1014.6 563.9 994.6 542.1 977.1 526.2C971.5 521.1 952.1 509 950.1 502.9C947.2 494.2 959.7 474.2 963.1 465.6C971.4 444.7 972.2 423 972.4 401.6Z';
  var BAOBAB_GROUND = 'M262.5 1324C770.2 1293.3 1277.8 1293.3 1785.5 1324C1785.5 1335.5 1785.5 1347 1785.5 1358.5C1277.8 1358.5 770.2 1358.5 262.5 1358.5C262.5 1347 262.5 1335.5 262.5 1324Z';
  var BAOBAB_CREDIT =
    '<p class="baobab-credit">' +
      '<svg class="baobab-credit-mark" xmlns="http://www.w3.org/2000/svg"' +
      ' viewBox="254.5 148.1 1539.0 1218.4" aria-hidden="true" focusable="false">' +
      '<path fill="currentColor" fill-rule="evenodd" d="' + BAOBAB_TREE + '"/>' +
      '<path fill="currentColor" d="' + BAOBAB_GROUND + '"/>' +
      '</svg>' +
      '<span lang-content="he" lang="he">עיצוב ובנייה: <span dir="ltr">Baobab Web Studio</span></span>' +
      '<span lang-content="en" lang="en">Design &amp; build: Baobab Web Studio</span>' +
    '</p>';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function navHTML(active) {
    return NAV.map(function (item) {
      var current = item.key === active;
      return '<a class="nu-nav__item' + (current ? ' is-current' : '') + '"' +
             ' href="' + esc(item.href) + '"' + (current ? ' aria-current="page"' : '') + '>' +
             '<span lang-content="he">' + esc(item.he) + '</span>' +
             '<span lang-content="en">' + esc(item.en) + '</span>' +
             '</a>';
    }).join('');
  }

  /* The logo is Noy's own handwriting, cut out of her paper (928x536). It is
     never rendered below 112px wide — under that the thin strokes of the
     lettering fade out. The header sits at 128px, which measures 74px tall.

     There is ONE mark, top corner only. The centred copy in the footer was
     removed on Noy's request ("not also in the middle of the page"). */

  /* The wordmark below points at './index.html', and after the cutover that
     is the FILM home page, not the shop. This was decided, not inherited.

     On the open web it is simply right: the logo is the way home, and home is
     the film. Nothing else on these pages offers that.

     Inside the installed app it resolves differently, and that is the part
     worth writing down. index.html's first script forwards an installed
     launch straight to './shop.html', so in the app every wordmark tap lands
     on the shop instead of the film. That is not a loop and not a trap — the
     forward is location.replace(), which leaves no history entry, so Back
     from the shop goes to the page the tap came from, not around again
     (verified). The app's own identity says the same thing: the manifest's
     start_url is './shop.html'. Noy installed a shop; in the shop app the
     mark leading to the shop is the honest answer.

     The alternative — pointing these at './shop.html' — was rejected because
     it would fix a case nobody is in (there is no "home page" inside a shop
     app) by breaking the case everybody is in: a customer on contact.html in
     an ordinary tab would tap the logo and be dropped in the menu.

     The cost is real and accepted: the film is unreachable from inside the
     installed app. If that ever needs to change, the fix belongs in
     index.html's installed-launch redirect, not here. */
  function nuikaHeader(active) {
    return '' +
      '<a class="nu-mark" href="./index.html" aria-label="NUIKA">' +
        '<span class="nu-mark__art"></span>' +
      '</a>' +
      '<nav class="nu-nav">' + navHTML(active) + '</nav>' +
      '<button class="nu-lang" type="button" data-nuika-lang></button>';
  }

  function nuikaFooter() {
    /* icon markup is ours, from SOCIAL above — never user input — so it goes
       in whole; href and the label are escaped like everything else. */
    var links = SOCIAL.map(function (s) {
      return '<a class="nu-soc" href="' + esc(s.href) + '" target="_blank" rel="noopener"' +
             ' aria-label="' + esc(s.he) + '" data-label-he="' + esc(s.he) + '" data-label-en="' + esc(s.en) + '">' +
             '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"' +
             ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
             s.icon + '</svg></a>';
    }).join('');
    return '' +
      '<div class="nu-soc-row">' + links + '</div>' +
      '<p class="nu-fine">' +
        '<span lang-content="he">' + esc(PLACE.he) + '</span>' +
        '<span lang-content="en">' + esc(PLACE.en) + '</span>' +
      '</p>' +
      /* Filled only by a page that asks for it — index.html does, from a
         single REST read of nuika/settings. Empty and hidden everywhere
         else, so no other page pays for a network round trip it will not
         use. */
      '<p class="nu-orders" data-nuika-orders hidden></p>' +
      '<a class="nu-to-shop" href="./shop.html">' +
        '<span lang-content="he">תפריט והזמנות</span>' +
        '<span lang-content="en">Menu &amp; orders</span>' +
      '</a>' +
      /* Terms, privacy and the accessibility statement are linked from every
         page, because the order form that collects a name and a phone number
         is reachable from every page. */
      '<nav class="nu-legal" aria-label="מידע משפטי">' +
        '<a href="./terms.html"><span lang-content="he">תנאי הזמנה</span><span lang-content="en">Order terms</span></a>' +
        '<a href="./privacy.html"><span lang-content="he">הודעת פרטיות</span><span lang-content="en">Privacy notice</span></a>' +
        '<a href="./accessibility.html"><span lang-content="he">הצהרת נגישות</span><span lang-content="en">Accessibility statement</span></a>' +
      '</nav>' +
      /* Always the last thing in the footer. */
      BAOBAB_CREDIT;
  }

  /* A visible sign that the page is still loading. Shown from the first moment these scripts run
     until the browser's own load event, with a ceiling so it can never get stuck on screen. */
  function showLoadBar() {
    if (document.readyState === 'complete') return;
    var bar = document.createElement('div');
    bar.className = 'nu-loadbar';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    var gone = false;
    function hide() {
      if (gone) return; gone = true;
      bar.classList.add('is-done');
      setTimeout(function () { if (bar.parentNode) bar.parentNode.removeChild(bar); }, 600);
    }
    window.addEventListener('load', hide);
    setTimeout(hide, 20000);
  }

  function mount() {
    showLoadBar();
    var head = document.querySelector('[data-nuika-header]');
    if (head) head.innerHTML = nuikaHeader(head.getAttribute('data-nuika-header'));
    var foot = document.querySelector('[data-nuika-footer]');
    if (foot) foot.innerHTML = nuikaFooter();

    /* A way past the menu, for keyboard and screen-reader users. Only on a
       page that has a #main to jump to. */
    if (document.getElementById('main') && !document.querySelector('.nu-skip')) {
      var skip = document.createElement('a');
      skip.className = 'nu-skip';
      skip.href = '#main';
      skip.innerHTML = '<span lang-content="he">דלגו לתוכן הראשי</span><span lang-content="en">Skip to main content</span>';
      document.body.insertBefore(skip, document.body.firstChild);
    }

    nuikaLang(readLang());
    releaseMotion();

    /* The other half of the transition that brought us here. Last, so the
       page underneath the panel is already built and laid out when the panel
       opens on it. */
    playArrival();
  }

  /* ---------- language ---------- */
  /* The shop already toggles with lang-content="he" / "en" attributes. The new
     pages use the same attribute so there is one idea to learn, not two. */

  var LANG_KEY = 'nuika-lang';

  function readLang() {
    try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'he'; }
    catch (e) { return 'he'; }   /* private mode throws rather than returning null */
  }

  /* The live language comes from the document, never from storage. A failed
     write must cost the visitor their preference on the NEXT visit, not the
     ability to switch at all on this one. */
  function currentLang() {
    return document.documentElement.getAttribute('lang') === 'en' ? 'en' : 'he';
  }

  /* Listeners for an actual language change. They fire from nuikaLang() only
     when the value moved, never on a same-language call — nuikaRefresh() calls
     nuikaLang(currentLang()) on purpose, and a listener that re-injects markup
     calls nuikaRefresh() in turn. Firing on every call would make that pair an
     infinite loop the first time anyone wired them together. */
  var langListeners = [];

  function nuikaOnLangChange(fn) {
    if (typeof fn === 'function') langListeners.push(fn);
  }

  function nuikaLang(next) {
    var wasLang = currentLang();
    var lang = next === 'en' ? 'en' : 'he';
    var root = document.documentElement;
    root.setAttribute('lang', lang);
    root.setAttribute('dir', lang === 'en' ? 'ltr' : 'rtl');

    var nodes = document.querySelectorAll('[lang-content]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].hidden = nodes[i].getAttribute('lang-content') !== lang;
    }

    /* An icon-only link has no text to swap, so its accessible name lives in
       an attribute and the [lang-content] pass above cannot reach it. Without
       this the social marks announce themselves in Hebrew to an English
       reader for the life of the page. */
    var labelled = document.querySelectorAll('[data-label-he][data-label-en]');
    for (var k = 0; k < labelled.length; k++) {
      var label = labelled[k].getAttribute('data-label-' + lang);
      if (label) labelled[k].setAttribute('aria-label', label);
    }

    var btn = document.querySelector('[data-nuika-lang]');
    if (btn) {
      btn.textContent = lang === 'he' ? 'EN' : 'עב';
      btn.setAttribute('aria-label', lang === 'he' ? 'Switch to English' : 'החלף לעברית');
    }

    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* nothing to do */ }

    /* One listener that throws must not stop the others, and must not leave
       the page half-switched. */
    if (lang !== wasLang) {
      for (var j = 0; j < langListeners.length; j++) {
        try { langListeners[j](lang); }
        catch (e) { console.error('nuika: a language listener threw', e); }
      }
    }
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-nuika-lang]');
    if (btn) nuikaLang(currentLang() === 'he' ? 'en' : 'he');
  });


  /* ---------- moving between pages ----------
   *
   * Every navigation inside the site plays a panel across the screen, and
   * the page being arrived at pulls the same panel away. Two flavours:
   *
   *   oven  — for the shop. A warm panel rises from the bottom and the
   *           wordmark settles into it. It is the door of the bakery, and it
   *           takes its time.
   *   sweep — everywhere else. The panel crosses in the reading direction,
   *           right to left in Hebrew and the other way in English, and it
   *           is quick: this happens on every link, so it has to stay out of
   *           the way.
   *
   * This wraps every internal click on the site, so it is built to fail
   * open. The click is only intercepted once every precondition is met, and
   * from there three separate things can complete the navigation: the
   * animation's own end, a watchdog timer, and a catch around the whole
   * attempt. Modified clicks, middle clicks, new tabs, downloads, other
   * origins, anchors on the same page, and anyone who asked for less motion
   * are never intercepted at all.
   *
   * The arriving half is what makes it a transition rather than a wipe
   * followed by a hard cut: the outgoing page leaves a note in
   * sessionStorage, and the page that loads next reads it, paints the panel
   * already closed, and opens it. The note is cleared the instant it is
   * read, so a stray one can never cover a page nobody navigated to.
   */
  var OVEN_MS  = 460;
  var SWEEP_MS = 340;
  var ARRIVE_KEY = 'nuika-arriving';

  function wantsStillness() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function makePanel(flavour) {
    var panel = document.createElement('div');
    panel.className = 'nu-door nu-door--' + flavour;
    panel.setAttribute('aria-hidden', 'true');
    if (flavour === 'oven') panel.innerHTML = '<span class="nu-door__mark"></span>';
    return panel;
  }

  /* Closes the panel over the page, then hands control back. */
  function closePanel(flavour, go) {
    var done = false;
    function finish() { if (done) return; done = true; go(); }

    try {
      var panel = makePanel(flavour);
      document.body.appendChild(panel);

      /* One frame, so the browser has a start state to animate FROM. Without
         it the class lands in the same style recalculation as the element
         itself and nothing moves. */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { panel.classList.add('is-shut'); });
      });

      panel.addEventListener('transitionend', function (e) {
        if (e.propertyName === 'transform') finish();
      });
    } catch (e) {
      finish();      /* no panel, but the visitor still gets where they asked */
      return;
    }

    /* The watchdog. transitionend does not fire on a background tab, and it
       does not fire at all if something upstream removed the transition. */
    setTimeout(finish, (flavour === 'oven' ? OVEN_MS : SWEEP_MS) + 160);
  }

  /* The other half, on the page being arrived at: paint the panel already
     closed and open it. */
  function openPanel(flavour) {
    var panel;
    try {
      panel = makePanel(flavour);
      panel.classList.add('is-shut');
      document.body.appendChild(panel);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { panel.classList.remove('is-shut'); });
      });
      panel.addEventListener('transitionend', function (e) {
        if (e.propertyName === 'transform' && panel.parentNode) panel.remove();
      });
    } catch (e) {
      if (panel && panel.parentNode) panel.remove();
      return;
    }
    /* Unconditional. Whatever happens to the transition, this panel comes off
       the page — it is the one thing here that is covering content. */
    setTimeout(function () { if (panel.parentNode) panel.remove(); },
               (flavour === 'oven' ? OVEN_MS : SWEEP_MS) + 260);
  }

  /* Back from a page restores the whole document from the browser's cache,
     panel and all, in whatever state it was left. That is an opaque sheet
     over the page, and because it takes no pointer events it does not even
     read as an overlay: the page simply looks broken until a manual reload. */
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    var stuck = document.querySelectorAll('.nu-door');
    for (var i = 0; i < stuck.length; i++) stuck[i].remove();
  });

  /* Which flavour a destination gets. The shop is the bakery door; every
     other page on the site is a sweep. */
  function flavourFor(pathname) {
    return /\/shop\.html$/.test(pathname) ? 'oven' : 'sweep';
  }

  /* A link this site should animate away from: same origin, a real page
     rather than an asset or a jump to an anchor on this one. */
  function internalPage(a) {
    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return null; }
    if (url.origin !== location.origin) return null;

    /* An anchor on the page we are already on is not a navigation. */
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return null;

    /* Pages, not files. Anything with another extension is a download or an
       asset and the browser should handle it untouched. */
    var last = url.pathname.split('/').pop();
    if (last && last.indexOf('.') !== -1 && !/\.html?$/i.test(last)) return null;

    return url;
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    if (a.getAttribute('href').charAt(0) === '#') return;

    var url = internalPage(a);
    if (!url) return;

    if (wantsStillness()) return;   /* let the browser navigate plainly */

    var flavour = flavourFor(url.pathname);
    e.preventDefault();

    /* Written before leaving, read by the page that loads next. */
    try { sessionStorage.setItem(ARRIVE_KEY, flavour); } catch (err) { /* fine without it */ }

    closePanel(flavour, function () { location.href = a.href; });
  });

  /* Arrival. Read once and cleared immediately, so a note left by a
     navigation that never completed cannot cover some later page. */
  function playArrival() {
    var flavour = null;
    try {
      flavour = sessionStorage.getItem(ARRIVE_KEY);
      sessionStorage.removeItem(ARRIVE_KEY);
    } catch (err) { return; }
    if (!flavour || wantsStillness()) return;
    openPanel(flavour === 'oven' ? 'oven' : 'sweep');
  }

  /* ---------- releasing the movements ---------- */
  /* Someone who asked for less motion gets the final state immediately. The
     CSS already renders it; this makes sure the script never undoes that. */

  /* One observer, created lazily and reused across every releaseMotion() call
     (mount() calls it once, nuikaRefresh() may call it many times after).
     Reusing it is what keeps a later call from watching the same element
     with a second, independent observer. */
  var motionObserver = null;

  function releaseMotion() {
    var targets = document.querySelectorAll('.rise, .fade, .reveal');
    var quiet = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (quiet || !('IntersectionObserver' in window)) {
      for (var i = 0; i < targets.length; i++) targets[i].classList.add('is-in');
      return;
    }

    if (!motionObserver) {
      motionObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          motionObserver.unobserve(entry.target);   /* one movement per element, never a loop */
        });
      }, { rootMargin: '0px 0px -12% 0px' });
    }

    for (var j = 0; j < targets.length; j++) {
      /* Already landed — leave it alone. Without this an element that was
         already unobserved after animating in would get observe()'d again
         and, since it is typically still on screen, would fire a second time. */
      if (targets[j].classList.contains('is-in')) continue;
      motionObserver.observe(targets[j]);   /* a no-op if already being watched */
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  /* Anything that injects [lang-content] or .rise/.fade/.reveal markup after
     load — the events board rendered from Firebase, for instance — must call
     this afterwards, or the new markup shows both languages at once and any
     motion class on it never releases. It never re-mounts the header or
     footer; it only re-applies the language and re-scans for new movement
     targets. */
  function nuikaRefresh() {
    nuikaLang(currentLang());
    releaseMotion();
  }

  window.nuikaHeader = nuikaHeader;
  window.nuikaFooter = nuikaFooter;
  window.nuikaLang = nuikaLang;
  window.nuikaRefresh = nuikaRefresh;
  window.nuikaEsc = esc;
  window.nuikaOnLangChange = nuikaOnLangChange;
})();
