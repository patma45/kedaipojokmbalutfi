(() => {
  const WHATSAPP_NUMBER = "6288212951881";
  const CART_STORAGE_KEY = "kedai-pojok-cart-v2";
  const cart = new Map();

  const formatRupiah = (value) => new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

  const normalizePrice = (value) => {
    const price = Number(value);
    return Number.isFinite(price) && price > 0 ? price : 0;
  };

  const normalizeQty = (value) => {
    const qty = Number.parseInt(value, 10);
    return Number.isFinite(qty) && qty > 0 ? qty : 1;
  };

  const normalizeCategory = (value) => value === "minuman" ? "minuman" : "makanan";

  const els = {
    drawer: document.querySelector(".cart-drawer"),
    backdrop: document.querySelector(".drawer-backdrop"),
    close: document.querySelector(".drawer-close"),
    items: document.querySelector(".cart-items"),
    empty: document.querySelector(".empty-cart"),
    subtotal: document.querySelector("#subtotal"),
    foodSubtotal: document.querySelector("#foodSubtotal"),
    drinkSubtotal: document.querySelector("#drinkSubtotal"),
    subtotalNote: document.querySelector("#subtotalNote"),
    counts: document.querySelectorAll(".cart-count, .cart-count-inline"),
    toast: document.querySelector(".toast"),
    send: document.querySelector(".send-order"),
    navToggle: document.querySelector(".nav-toggle"),
    nav: document.querySelector(".main-nav"),
    floatingCart: document.querySelector(".floating-cart")
  };

  function summarizeCart(items = [...cart.values()]) {
    const summary = {
      totalQty: 0,
      knownSubtotal: 0,
      unknownQty: 0,
      unknownItems: [],
      makanan: { qty: 0, knownSubtotal: 0, unknownQty: 0 },
      minuman: { qty: 0, knownSubtotal: 0, unknownQty: 0 }
    };

    items.forEach((item) => {
      const category = normalizeCategory(item.category);
      const qty = normalizeQty(item.qty);
      const price = normalizePrice(item.price);
      const lineTotal = price * qty;

      summary.totalQty += qty;
      summary.knownSubtotal += lineTotal;
      summary[category].qty += qty;
      summary[category].knownSubtotal += lineTotal;

      if (price === 0) {
        summary.unknownQty += qty;
        summary[category].unknownQty += qty;
        summary.unknownItems.push(`${item.name} x${qty}`);
      }
    });

    return summary;
  }

  function formatSubtotalDisplay(knownSubtotal, unknownQty) {
    if (unknownQty > 0 && knownSubtotal === 0) return "Konfirmasi via WA";
    if (unknownQty > 0) return `${formatRupiah(knownSubtotal)} + konfirmasi`;
    return formatRupiah(knownSubtotal);
  }

  function saveCart() {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([...cart.values()]));
    } catch (error) {
      // Kalkulasi tetap berjalan bila penyimpanan lokal diblokir browser.
    }
  }

  function restoreCart() {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
      if (!Array.isArray(saved)) return;

      saved.forEach((item) => {
        if (!item || typeof item.name !== "string" || !item.name.trim()) return;
        cart.set(item.name.trim(), {
          name: item.name.trim(),
          price: normalizePrice(item.price),
          qty: normalizeQty(item.qty),
          category: normalizeCategory(item.category)
        });
      });
    } catch (error) {
      try { localStorage.removeItem(CART_STORAGE_KEY); } catch (storageError) {}
    }
  }

  function showToast(message = "Menu ditambahkan ke pesanan") {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.add("show");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 1700);
  }

  function openDrawer() {
    if (!els.drawer || !els.backdrop) return;
    els.drawer.classList.add("is-open");
    els.drawer.setAttribute("aria-hidden", "false");
    els.backdrop.hidden = false;
    document.body.classList.add("drawer-open");
  }

  function closeDrawer() {
    if (!els.drawer || !els.backdrop) return;
    els.drawer.classList.remove("is-open");
    els.drawer.setAttribute("aria-hidden", "true");
    els.backdrop.hidden = true;
    document.body.classList.remove("drawer-open");
  }

  function addItem(name, price, category) {
    if (!name) return;
    const cleanName = String(name).trim();
    const item = cart.get(cleanName) || {
      name: cleanName,
      price: normalizePrice(price),
      qty: 0,
      category: normalizeCategory(category)
    };

    item.price = normalizePrice(price);
    item.category = normalizeCategory(category || item.category);
    item.qty += 1;
    cart.set(cleanName, item);

    saveCart();
    renderCart();
    showToast(`${cleanName} ditambahkan`);
  }

  function changeQty(name, delta) {
    const item = cart.get(name);
    if (!item) return;

    item.qty += Number(delta) || 0;
    if (item.qty <= 0) cart.delete(name);
    else cart.set(name, item);

    saveCart();
    renderCart();
  }

  function createCartItem(item) {
    const row = document.createElement("div");
    row.className = "cart-item";

    const copy = document.createElement("div");
    copy.className = "cart-item-copy";

    const category = document.createElement("span");
    category.className = "cart-item-category";
    category.textContent = normalizeCategory(item.category) === "minuman" ? "Minuman" : "Makanan";

    const name = document.createElement("strong");
    name.textContent = item.name;

    const detail = document.createElement("small");
    const price = normalizePrice(item.price);
    detail.textContent = price > 0
      ? `${formatRupiah(price)} × ${item.qty} = ${formatRupiah(price * item.qty)}`
      : `Harga dikonfirmasi via WA × ${item.qty}`;

    copy.append(category, name, detail);

    const control = document.createElement("div");
    control.className = "qty-control";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.setAttribute("aria-label", `Kurangi ${item.name}`);
    minus.textContent = "−";
    minus.addEventListener("click", () => changeQty(item.name, -1));

    const qty = document.createElement("span");
    qty.textContent = item.qty;

    const plus = document.createElement("button");
    plus.type = "button";
    plus.setAttribute("aria-label", `Tambah ${item.name}`);
    plus.textContent = "+";
    plus.addEventListener("click", () => changeQty(item.name, 1));

    control.append(minus, qty, plus);
    row.append(copy, control);
    return row;
  }

  function renderCart() {
    const items = [...cart.values()];
    const summary = summarizeCart(items);

    els.counts.forEach((element) => { element.textContent = summary.totalQty; });
    els.floatingCart?.classList.toggle("has-items", summary.totalQty > 0);

    if (els.empty) els.empty.style.display = items.length ? "none" : "block";
    if (els.items) {
      els.items.replaceChildren(...items.map(createCartItem));
    }

    if (els.foodSubtotal) {
      els.foodSubtotal.textContent = formatSubtotalDisplay(
        summary.makanan.knownSubtotal,
        summary.makanan.unknownQty
      );
    }
    if (els.drinkSubtotal) {
      els.drinkSubtotal.textContent = formatSubtotalDisplay(
        summary.minuman.knownSubtotal,
        summary.minuman.unknownQty
      );
    }
    if (els.subtotal) {
      els.subtotal.textContent = formatSubtotalDisplay(summary.knownSubtotal, summary.unknownQty);
    }

    if (els.subtotalNote) {
      if (summary.unknownItems.length) {
        els.subtotalNote.textContent = `Belum termasuk harga ${summary.unknownItems.join(", ")}. Harga tersebut dan ongkir dikonfirmasi melalui WhatsApp.`;
        els.subtotalNote.classList.add("has-pending-price");
      } else {
        els.subtotalNote.textContent = "Subtotal otomatis mengikuti jenis menu dan jumlah yang dipilih. Ongkir dikonfirmasi melalui WhatsApp.";
        els.subtotalNote.classList.remove("has-pending-price");
      }
    }
  }

  function sendToWhatsApp() {
    const items = [...cart.values()];
    if (!items.length) {
      showToast("Pilih menu terlebih dahulu");
      return;
    }

    const customerName = document.querySelector("#customerName")?.value.trim() || "-";
    const address = document.querySelector("#customerAddress")?.value.trim() || "-";
    const note = document.querySelector("#customerNote")?.value.trim() || "-";
    const summary = summarizeCart(items);

    const itemLines = items.map((item, index) => {
      const price = normalizePrice(item.price);
      const lineTotal = price > 0 ? formatRupiah(price * item.qty) : "konfirmasi harga";
      const category = normalizeCategory(item.category) === "minuman" ? "Minuman" : "Makanan";
      return `${index + 1}. [${category}] ${item.name} x${item.qty} — ${lineTotal}`;
    });

    const summaryLines = [
      `Subtotal makanan terdata: ${formatRupiah(summary.makanan.knownSubtotal)}`,
      `Subtotal minuman terdata: ${formatRupiah(summary.minuman.knownSubtotal)}`,
      `Subtotal menu terdata: ${formatRupiah(summary.knownSubtotal)}`
    ];

    if (summary.unknownItems.length) {
      summaryLines.push(`Harga belum terdata: ${summary.unknownItems.join(", ")}`);
    }

    const message = [
      "Halo Mba Lutfi, saya mau pesan:",
      "",
      ...itemLines,
      "",
      ...summaryLines,
      "Ongkir: mohon dikonfirmasi sesuai alamat.",
      "",
      `Nama: ${customerName}`,
      `Alamat/patokan: ${address}`,
      `Catatan: ${note}`,
      "",
      "Mohon konfirmasi stok, harga yang belum terdata, dan total pembayarannya. Terima kasih."
    ].join("\n");

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener");
  }

  document.querySelectorAll(".add-button, .quick-add").forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.dataset.category
        || button.closest(".menu-card")?.dataset.category
        || "makanan";
      addItem(button.dataset.name, button.dataset.price, category);
    });
  });

  document.querySelectorAll(".open-cart").forEach((button) => button.addEventListener("click", openDrawer));
  els.close?.addEventListener("click", closeDrawer);
  els.backdrop?.addEventListener("click", closeDrawer);
  els.send?.addEventListener("click", sendToWhatsApp);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeDrawer(); });

  document.querySelectorAll(".category-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".category-tab").forEach((button) => button.classList.remove("active"));
      tab.classList.add("active");
      const filter = tab.dataset.filter;
      document.querySelectorAll(".menu-card").forEach((card) => {
        card.classList.toggle("is-hidden", filter !== "all" && card.dataset.category !== filter);
      });
    });
  });

  els.navToggle?.addEventListener("click", () => {
    const isOpen = els.nav?.classList.toggle("is-open") || false;
    els.navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  els.nav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
    els.nav.classList.remove("is-open");
    els.navToggle?.setAttribute("aria-expanded", "false");
  }));

  restoreCart();
  renderCart();
})();

// Ambil elemen tombol
const backToTopBtn = document.getElementById("backToTop");

// Fungsi untuk memantau scroll
window.addEventListener("scroll", () => {
  // Jika scroll lebih dari 300px dari atas, munculkan tombol
  if (window.pageYOffset > 300) {
    backToTopBtn.classList.add("show");
  } else {
    backToTopBtn.classList.remove("show");
  }
});

// Fungsi saat tombol diklik
backToTopBtn.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth" // Efek scroll halus
  });
});
