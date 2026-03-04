document.addEventListener('DOMContentLoaded', function(){

let cart = [];
let discountRate = 0;

let inventory = {
    'Leggings Sculpt':5,
    'Top Energy':6,
    'Serum Glow':8,
    'Leggings Sculpt Pro':4,
    'Set Deportivo Beige':7,
    'Short Sculpt':6,
    'Top Seamless':6,
    'Hoodie Active':5,
    'Kit Facial Glow':8,
    'Body Oil Reafirmante':6,
    'Protector Solar Sport':10,
    'Mascarilla Detox':9,
    'Lip Oil Hydrating':8,
    'Crema Día Hydralift':7,
    'Sérum Vitamina C+':7,
    'Bruma Facial Refresh':9,
    'Exfoliante Body Glow':8,
    'Mascarilla Nocturna Repair':7
};

const CART_STORAGE_KEY = 'mg_cart_v1';
const DISCOUNT_STORAGE_KEY = 'mg_discount_v1';

function saveCartState(){
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    localStorage.setItem(DISCOUNT_STORAGE_KEY, String(discountRate));
}

function loadCartState(){
    const storedCart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
    const storedDiscount = parseFloat(localStorage.getItem(DISCOUNT_STORAGE_KEY) || '0');

    if(Array.isArray(storedCart)){
        cart = storedCart
            .filter(item => item && typeof item.name === 'string' && typeof item.price === 'number')
            .map(item => ({ ...item, quantity: Math.max(1, parseInt(item.quantity || 1, 10)) }));
    }

    discountRate = Number.isFinite(storedDiscount) ? storedDiscount : 0;
}

function reserveInventoryForCart(){
    cart.forEach(item => {
        if(inventory[item.name] !== undefined){
            inventory[item.name] = Math.max(0, inventory[item.name] - item.quantity);
        }
    });
}

function ensureInventoryCoverage(){
    document.querySelectorAll('.products .card').forEach(card => {
        const name = (card.querySelector('h3')?.textContent || '').trim();
        if(!name || inventory[name] !== undefined) return;
        const declaredStock = parseInt(card.dataset.stock || '', 10);
        inventory[name] = Number.isFinite(declaredStock) && declaredStock >= 0 ? declaredStock : 999;
    });
}

function resolveProductImage(name){
    const cards = Array.from(document.querySelectorAll('.card'));
    const match = cards.find(card => {
        const title = card.querySelector('h3');
        return title && title.textContent.trim() === name;
    });

    if(!match) return null;

    const activeImage = match.querySelector('.product-images img.active');
    if(activeImage && activeImage.src) return activeImage.src;

    const image = match.querySelector('img');
    return image && image.src ? image.src : null;
}

function getCartTotals(){
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discount = 0;
    const shippingCost = 0;
    const total = subtotal;
    return { subtotal, discount, shippingCost, total };
}

function renderCheckoutSummary(){
    const summaryEl = document.getElementById('checkoutSummary');
    if(!summaryEl) return;

    if(cart.length === 0){
        summaryEl.innerHTML = '<strong>Tu canasta está vacía.</strong>';
        return;
    }

    const items = cart.map((item, idx) =>
        `${idx + 1}. ${item.name}${item.size ? ` (Talla: ${item.size})` : ''}${item.color ? ` (Color: ${item.color})` : ''} x${item.quantity} - $${(item.price * item.quantity).toFixed(2)}`
    ).join('<br>');
    const totals = getCartTotals();

    summaryEl.innerHTML = `
        <strong>Resumen del pedido</strong><br><br>
        ${items}<br><br>
        <strong>Total: $${totals.total.toFixed(2)}</strong>
    `;
}

window.toggleCart = function(){
    const cartEl = document.getElementById('cart');
    if(cartEl) cartEl.classList.toggle('active');
}

window.addToCart = function(name, price, size = null, color = null, image = null){
    if(inventory[name] !== undefined){
        if(inventory[name] <= 0){
            alert('Producto agotado');
            return;
        }
        inventory[name]--;
    }

    const existingIndex = cart.findIndex(item =>
        item.name === name &&
        item.size === size &&
        item.color === color
    );

    if(existingIndex >= 0){
        cart[existingIndex].quantity += 1;
    } else {
        cart.push({name, price, size, color, image: image || resolveProductImage(name), quantity: 1});
    }

    window.updateCart();
}

window.increaseQty = function(index){
    const item = cart[index];
    if(!item) return;

    if(inventory[item.name] !== undefined){
        if(inventory[item.name] <= 0){
            alert('No hay más stock disponible de este producto.');
            return;
        }
        inventory[item.name]--;
    }

    item.quantity += 1;
    window.updateCart();
}

window.decreaseQty = function(index){
    let item = cart[index];
    if(!item) return;

    if(item.quantity > 1){
        item.quantity -= 1;
        if(inventory[item.name] !== undefined){
            inventory[item.name]++;
        }
    } else {
        if(item && inventory[item.name] !== undefined){
            inventory[item.name]++;
        }
        cart.splice(index,1);
    }
    window.updateCart();
}

window.removeItem = function(index){
    let item = cart[index];
    if(!item) return;

    if(item && inventory[item.name] !== undefined){
        inventory[item.name] += item.quantity;
    }
    cart.splice(index,1);
    window.updateCart();
}

window.clearCart = function(){
    cart.forEach(item => {
        if(inventory[item.name] !== undefined){
            inventory[item.name] += item.quantity;
        }
    });
    cart = [];
    window.updateCart();
}

function updateCart(){
    const cartItems = document.getElementById('cartItems');
    const totalEl = document.getElementById('total');
    const countEl = document.getElementById('cartCount');
    const metaEl = document.getElementById('cartMeta');
    if(!cartItems || !totalEl || !countEl) return;

    cartItems.innerHTML = '';

    cart.forEach((item,index)=>{
        cartItems.innerHTML += `
        <div class="cart-line" style="display:flex;justify-content:space-between;gap:8px;margin-bottom:10px;">
            <div style="display:flex;gap:8px;align-items:flex-start;max-width:70%;">
                ${item.image ? `<img src="${item.image}" alt="${item.name}" style="width:52px;height:52px;object-fit:cover;border-radius:8px;border:1px solid #e7d7cc;">` : ''}
                <span>${item.name} ${item.size ? '- Talla: '+item.size : ''} ${item.color ? '- Color: '+item.color : ''}<br>x${item.quantity} · $${item.price.toFixed(2)} c/u · <strong>$${(item.price * item.quantity).toFixed(2)}</strong></span>
            </div>
            <div class="qty-controls" style="display:flex;align-items:center;gap:6px;">
                <button onclick="decreaseQty(${index})" style="background:#6b4f43;color:white;border:none;padding:4px 8px;border-radius:8px;cursor:pointer;">-</button>
                <span>${item.quantity}</span>
                <button onclick="increaseQty(${index})" style="background:#6b4f43;color:white;border:none;padding:4px 8px;border-radius:8px;cursor:pointer;">+</button>
                <button onclick="removeItem(${index})" style="background:red;color:white;border:none;padding:4px 8px;border-radius:8px;cursor:pointer;">X</button>
            </div>
        </div>`;
    });

    const totals = getCartTotals();
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    totalEl.innerText = `Total: $${totals.total.toFixed(2)}`;
    countEl.innerText = itemCount;
    if(metaEl){
        metaEl.innerText = `${itemCount} producto${itemCount === 1 ? '' : 's'} · Subtotal $${totals.subtotal.toFixed(2)}`;
    }
    renderCheckoutSummary();
    saveCartState();
}
window.updateCart = updateCart;

window.addToCartFromCard = function(button, name, price){
    const card = button ? button.closest('.card') : null;
    const sizeSelect = card ? card.querySelector('select') : null;
    const size = sizeSelect ? sizeSelect.value : null;
    const color = card && card.dataset.selectedColor ? card.dataset.selectedColor : null;
    const activeImage = card ? card.querySelector('.product-images img.active') : null;
    const fallbackImage = card ? card.querySelector('img') : null;
    const image = activeImage?.src || fallbackImage?.src || null;
    window.addToCart(name, price, size, color, image);
}

window.selectColor = function(el, color){
    const card = el.closest('.card');
    if(!card) return;
    card.dataset.selectedColor = color;
    card.querySelectorAll('.color-picker .color').forEach(dot => dot.classList.remove('selected'));
    el.classList.add('selected');
}

window.goToCategory = function(category){
    const select = document.getElementById('filterCategory');
    if(select){
        select.value = category;
        window.filterProducts();
    }

    const targetId = category === 'beauty' ? 'oferta' : category;
    const section = document.getElementById(targetId);
    if(section){
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

window.applyCoupon = function(){
    discountRate = 0;
    window.updateCart();
}

window.checkoutWhatsApp = function(){
    if(cart.length === 0){
        alert('Tu canasta está vacía.');
        return;
    }

    const totals = getCartTotals();

    const lines = cart.map((item, index) =>
        `${index + 1}. ${item.name}${item.size ? ` (Talla: ${item.size})` : ''}${item.color ? ` (Color: ${item.color})` : ''} x${item.quantity} - $${(item.price * item.quantity).toFixed(2)}`
    );

    const message = [
        'Hola MG Activewear, quiero finalizar mi pedido:',
        '',
        ...lines,
        '',
        `Total: $${totals.total.toFixed(2)}`
    ].join('\n');

    window.open(`https://wa.me/50765010703?text=${encodeURIComponent(message)}`, '_blank');
}

window.checkoutInstagram = async function(){
    if(cart.length === 0){
        alert('Tu canasta está vacía.');
        return;
    }

    const totals = getCartTotals();
    const lines = cart.map((item, index) =>
        `${index + 1}. ${item.name}${item.size ? ` (Talla: ${item.size})` : ''}${item.color ? ` (Color: ${item.color})` : ''} x${item.quantity} - $${(item.price * item.quantity).toFixed(2)}`
    );

    const message = [
        'Hola MG Activewear, quiero finalizar mi pedido por Instagram:',
        '',
        ...lines,
        '',
        `Total: $${totals.total.toFixed(2)}`
    ].join('\n');

    try{
        if(navigator.clipboard && navigator.clipboard.writeText){
            await navigator.clipboard.writeText(message);
            alert('Resumen copiado. Se abrirá Instagram, pega el mensaje en el chat.');
        } else {
            alert('Se abrirá Instagram. Copia manualmente tu resumen desde el carrito.');
        }
    } catch(_err){
        alert('Se abrirá Instagram. Si no se copió el texto, envíanos tu pedido manualmente.');
    }

    const username = 'mgactivewearspa';
    const dmUrl = `https://ig.me/m/${username}`;
    const profileUrl = `https://www.instagram.com/${username}/`;
    const appProfileUrl = `instagram://user?username=${username}`;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

    if(isMobile){
        window.location.href = appProfileUrl;
        setTimeout(() => {
            window.location.href = dmUrl;
        }, 900);
        return;
    }

    const dmWindow = window.open(dmUrl, '_blank');
    if(!dmWindow){
        window.open(profileUrl, '_blank');
    }
}

window.openCheckout = function(){
    if(cart.length === 0){
        alert('Agrega productos antes de finalizar.');
        return;
    }
    const panel = document.getElementById('checkoutPanel');
    if(!panel) return;
    renderCheckoutSummary();
    panel.classList.add('active');
    panel.setAttribute('aria-hidden', 'false');
}

window.closeCheckout = function(){
    const panel = document.getElementById('checkoutPanel');
    const msg = document.getElementById('checkoutMessage');
    if(panel){
        panel.classList.remove('active');
        panel.setAttribute('aria-hidden', 'true');
    }
    if(msg) msg.textContent = '';
}

window.placeOrder = function(){
    if(cart.length === 0){
        alert('Tu canasta está vacía.');
        return;
    }

    const name = document.getElementById('customerName')?.value.trim() || '';
    const email = document.getElementById('customerEmail')?.value.trim() || '';
    const phone = document.getElementById('customerPhone')?.value.trim() || '';
    const address = document.getElementById('customerAddress')?.value.trim() || '';
    const paymentMethod = document.getElementById('paymentMethod')?.value || '';
    const notes = document.getElementById('customerNotes')?.value.trim() || '';
    const msg = document.getElementById('checkoutMessage');

    if(!name || !phone || !paymentMethod){
        alert('Completa nombre, teléfono y método de pago.');
        return;
    }
    const totals = getCartTotals();
    const orderId = `MG-${Date.now().toString().slice(-6)}`;
    const order = {
        id: orderId,
        date: new Date().toISOString(),
        customer: { name, email, phone, address, paymentMethod, notes },
        items: cart.map(item => ({ ...item })),
        totals
    };

    const payload = {
        productos: order.items,
        total: order.totals.total,
        cliente: order.customer
    };

    if(msg){
        msg.textContent = 'Enviando pedido...';
    }

    fetch('http://localhost:3000/api/pedido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(async res => {
        let body = null;
        try{
            body = await res.json();
        } catch(_err){
            body = null;
        }

        if(!res.ok){
            throw new Error((body && body.mensaje) || 'No se pudo guardar el pedido.');
        }
    })
    .then(() => {
        const existingOrders = JSON.parse(localStorage.getItem('mg_orders') || '[]');
        existingOrders.push(order);
        localStorage.setItem('mg_orders', JSON.stringify(existingOrders));

        if(msg){
            msg.textContent = `Pedido confirmado: ${orderId}. Te contactaremos pronto para coordinar la entrega.`;
        }

        cart = [];
        window.updateCart();
        saveCartState();

        ['customerName','customerEmail','customerPhone','customerAddress','paymentMethod','customerNotes']
            .forEach(id => {
                const el = document.getElementById(id);
                if(el) el.value = '';
            });
    })
    .catch(() => {
        if(msg){
            msg.textContent = 'No se pudo enviar el pedido al servidor. Verifica que el backend esté activo en el puerto 3000.';
        }
    });
}

const checkoutPanel = document.getElementById('checkoutPanel');
if(checkoutPanel){
    checkoutPanel.addEventListener('click', function(e){
        if(e.target === checkoutPanel){
            window.closeCheckout();
        }
    });
}

window.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){
        window.closeCheckout();
    }
});

loadCartState();
ensureInventoryCoverage();
reserveInventoryForCart();
window.updateCart();

function applyProductVisibility(){
    const categorySelect = document.getElementById('filterCategory');
    const searchInput = document.getElementById('productSearch');
    const category = categorySelect ? categorySelect.value : 'all';
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    document.querySelectorAll('.products .card').forEach(card => {
        const cardCategory = card.dataset.category;
        const title = (card.querySelector('h3')?.textContent || '').toLowerCase();

        const matchesCategory = category === 'all' || cardCategory === category;
        const matchesSearch = query === '' || title.includes(query);

        if(matchesCategory && matchesSearch){
            card.style.display = 'block';
            card.classList.add('show');
        } else {
            card.style.display = 'none';
        }
    });
}

window.filterProducts = function(){
    applyProductVisibility();
}

window.searchProducts = function(){
    applyProductVisibility();
}

window.sortProducts = function(){
    const select = document.getElementById('sortPrice');
    const containers = Array.from(document.querySelectorAll('.products'));
    if(!select || !containers.length) return;

    let sort = select.value;
    containers.forEach(container => {
        let cards = Array.from(container.querySelectorAll('.card'));

        cards.sort((a,b)=>{
            let priceA = parseFloat(a.dataset.price) || 0;
            let priceB = parseFloat(b.dataset.price) || 0;
            if(sort === 'low') return priceA - priceB;
            if(sort === 'high') return priceB - priceA;
            return 0;
        });

        cards.forEach(card=>container.appendChild(card));
    });
}

// TEMPORIZADOR SEGURO
let countdownEl = document.getElementById('countdown');
if(countdownEl){
    let endDate = new Date();
    endDate.setHours(endDate.getHours() + 24);

    setInterval(function(){
        let now = new Date().getTime();
        let distance = endDate - now;

        if(distance <= 0){
            countdownEl.innerText = 'Oferta finalizada';
            return;
        }

        let hours = Math.floor((distance / (1000 * 60 * 60)) % 24);
        let minutes = Math.floor((distance / (1000 * 60)) % 60);
        let seconds = Math.floor((distance / 1000) % 60);

        countdownEl.innerText = hours + 'h ' + minutes + 'm ' + seconds + 's';
    },1000);
}

});
const cards = document.querySelectorAll('.card');

window.addEventListener('scroll', () => {
cards.forEach(card => {
const rect = card.getBoundingClientRect();
if(rect.top < window.innerHeight - 100){
card.classList.add('show');
}
});
});
function changeImage(el, index) {
  const card = el.closest('.card');
  const images = card.querySelectorAll('.product-images img');
  if(!images.length || !images[index]) return;
  images.forEach(img => img.classList.remove('active'));
  images[index].classList.add('active');
}
function nextImage(button) {
  const card = button.closest('.card');
  const images = card.querySelectorAll('.product-images img');
  if(images.length < 2) return;
  let activeIndex = Array.from(images).findIndex(img => img.classList.contains('active'));
  if(activeIndex === -1) activeIndex = 0;
  images[activeIndex].classList.remove('active');
  let nextIndex = (activeIndex + 1) % images.length;
  images[nextIndex].classList.add('active');
}

function prevImage(button) {
  const card = button.closest('.card');
  const images = card.querySelectorAll('.product-images img');
  if(images.length < 2) return;
  let activeIndex = Array.from(images).findIndex(img => img.classList.contains('active'));
  if(activeIndex === -1) activeIndex = 0;
  images[activeIndex].classList.remove('active');
  let prevIndex = (activeIndex - 1 + images.length) % images.length;
  images[prevIndex].classList.add('active');
}
function enviarPedido() {
  const nombre = document.getElementById("nombre").value;
  const telefono = document.getElementById("telefono").value;

  fetch("http://localhost:3000/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      customerName: nombre,
      phone: telefono,
      products: carrito,
      total: total
    })
  })
  .then(res => res.json())
  .then(data => {
    alert("Pedido enviado correctamente 🔥");
    carrito = [];
    actualizarCarrito();
  });
}
