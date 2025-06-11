// PASO 1: CONFIGURACIÓN DE FIREBASE (¡REEMPLAZA CON TUS PROPIAS CREDENCIALES!)
  const firebaseConfig = {
    apiKey: "AIzaSyBZEVISZuRfn1iC3be5b7xTMQiCZubXyTU",
    authDomain: "bdnosql-de619.firebaseapp.com",

  };

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);

// Obtén referencias a los servicios de Firebase
const auth = firebase.auth();
const db = firebase.firestore();

// --- Referencias a elementos del DOM ---
const authStatusElem = document.getElementById('auth-status');
const authFormsElem = document.getElementById('auth-forms');
const btnLogout = document.getElementById('btn-logout');

// Signup elements
const signupEmail = document.getElementById('signup-email');
const signupPassword = document.getElementById('signup-password');
const btnSignup = document.getElementById('btn-signup');
const signupError = document.getElementById('signup-error');

// Login elements
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const btnLogin = document.getElementById('btn-login');
const loginError = document.getElementById('login-error');

// POS elements
const posSection = document.getElementById('pos-section');
const productsContainer = document.getElementById('products-container');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalElem = document.getElementById('cart-total');
const btnCheckout = document.getElementById('btn-checkout');
const checkoutMessage = document.getElementById('checkout-message');

// --- Variables Globales del POS ---
let products = []; // Almacena los productos cargados de Firestore
let cart = [];     // Almacena los productos en el carrito

// --- Funciones de Autenticación ---

btnSignup.addEventListener('click', async () => {
    const email = signupEmail.value;
    const password = signupPassword.value;
    signupError.textContent = '';
    try {
        await auth.createUserWithEmailAndPassword(email, password);
        signupEmail.value = '';
        signupPassword.value = '';
    } catch (error) {
        console.error("Error al registrar: ", error);
        signupError.textContent = `Error: ${error.message}`;
    }
});

btnLogin.addEventListener('click', async () => {
    const email = loginEmail.value;
    const password = loginPassword.value;
    loginError.textContent = '';
    try {
        await auth.signInWithEmailAndPassword(email, password);
        loginEmail.value = '';
        loginPassword.value = '';
    } catch (error) {
        console.error("Error al iniciar sesión: ", error);
        loginError.textContent = `Error: ${error.message}`;
    }
});

btnLogout.addEventListener('click', async () => {
    try {
        await auth.signOut();
    } catch (error) {
        console.error("Error al cerrar sesión: ", error);
    }
});

// --- Manejo del Estado de Autenticación ---
auth.onAuthStateChanged(user => {
    if (user) {
        authStatusElem.textContent = `Conectado como: ${user.email}`;
        authFormsElem.classList.add('hidden');
        btnLogout.classList.remove('hidden');
        posSection.classList.remove('hidden'); // Mostrar la sección del POS
        loadProducts(); // Cargar productos al iniciar sesión
    } else {
        authStatusElem.textContent = 'No hay usuario conectado.';
        authFormsElem.classList.remove('hidden');
        btnLogout.classList.add('hidden');
        posSection.classList.add('hidden'); // Ocultar la sección del POS
        productsContainer.innerHTML = '<p>Inicia sesión para ver los productos.</p>';
        cart = []; // Limpiar carrito al desconectar
        updateCartDisplay();
    }
});

// --- Funciones del Punto de Venta (POS) ---

// Cargar productos de Firestore
async function loadProducts() {
    productsContainer.innerHTML = '<p>Cargando productos...</p>';
    products = []; // Limpiar la lista local de productos

    try {
        const snapshot = await db.collection("products").get();
        if (snapshot.empty) {
            productsContainer.innerHTML = '<p>No hay productos disponibles.</p>';
            return;
        }

        productsContainer.innerHTML = ''; // Limpiar el contenido previo
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            products.push(product); // Añadir a la lista local

            const productItem = document.createElement('div');
            productItem.classList.add('product-item');
            productItem.innerHTML = `
                <div class="product-info">
                    <strong>${product.name}</strong>
                    <p>Precio: $${product.price.toFixed(2)} | Stock: ${product.stock}</p>
                </div>
                <div class="add-to-cart-controls">
                    <input type="number" value="1" min="1" max="${product.stock}" id="qty-${product.id}">
                    <button data-id="${product.id}" class="add-to-cart-btn" ${product.stock === 0 ? 'disabled' : ''}>Añadir</button>
                </div>
            `;
            productsContainer.appendChild(productItem);
        });

        // Añadir event listeners a los botones de añadir al carrito
        document.querySelectorAll('.add-to-cart-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const productId = event.target.dataset.id;
                const quantityInput = document.getElementById(`qty-${productId}`);
                const quantity = parseInt(quantityInput.value);
                if (quantity > 0) {
                    addToCart(productId, quantity);
                }
            });
        });

    } catch (error) {
        console.error("Error al cargar productos: ", error);
        productsContainer.innerHTML = `<p class="error-message">Error al cargar productos: ${error.message}</p>`;
    }
}

// Añadir producto al carrito
function addToCart(productId, quantity) {
    const productToAdd = products.find(p => p.id === productId);

    if (!productToAdd) {
        console.error("Producto no encontrado:", productId);
        return;
    }
    if (quantity > productToAdd.stock) {
        alert(`No hay suficiente stock para ${productToAdd.name}. Solo quedan ${productToAdd.stock}.`);
        return;
    }

    const existingCartItem = cart.find(item => item.id === productId);

    if (existingCartItem) {
        if (existingCartItem.quantity + quantity > productToAdd.stock) {
             alert(`No puedes añadir más de ${productToAdd.stock} unidades de ${productToAdd.name} al carrito.`);
             return;
        }
        existingCartItem.quantity += quantity;
    } else {
        cart.push({ ...productToAdd, quantity: quantity });
    }
    updateCartDisplay();
}

// Actualizar cantidad en el carrito
function updateCartItemQuantity(productId, newQuantity) {
    const productInList = products.find(p => p.id === productId);
    const cartItem = cart.find(item => item.id === productId);

    if (!cartItem || !productInList) return;

    if (newQuantity <= 0) {
        removeFromCart(productId);
        return;
    }

    if (newQuantity > productInList.stock) {
        alert(`No puedes añadir más de ${productInList.stock} unidades de ${productInList.name}.`);
        cartItem.quantity = productInList.stock; // Ajustar a la cantidad máxima
    } else {
        cartItem.quantity = newQuantity;
    }
    updateCartDisplay();
}

// Eliminar producto del carrito
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartDisplay();
}

// Actualizar la interfaz del carrito y el total
function updateCartDisplay() {
    cartItemsContainer.innerHTML = '';
    let total = 0;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p>El carrito está vacío.</p>';
        btnCheckout.disabled = true;
    } else {
        cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;

            const cartItemElem = document.createElement('div');
            cartItemElem.classList.add('cart-item');
            cartItemElem.innerHTML = `
                <div class="cart-item-info">
                    <strong>${item.name}</strong>
                    <p>${item.quantity} x $${item.price.toFixed(2)} = $${itemTotal.toFixed(2)}</p>
                </div>
                <div class="cart-item-controls">
                    <input type="number" value="${item.quantity}" min="1" max="${item.stock}" 
                           data-id="${item.id}" class="cart-qty-input">
                    <button data-id="${item.id}" class="remove-btn">Eliminar</button>
                </div>
            `;
            cartItemsContainer.appendChild(cartItemElem);
        });
        btnCheckout.disabled = false;

        // Añadir event listeners para cambiar cantidad y eliminar
        document.querySelectorAll('.cart-qty-input').forEach(input => {
            input.addEventListener('change', (event) => {
                const productId = event.target.dataset.id;
                const newQuantity = parseInt(event.target.value);
                updateCartItemQuantity(productId, newQuantity);
            });
        });
        document.querySelectorAll('.remove-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const productId = event.target.dataset.id;
                removeFromCart(productId);
            });
        });
    }

    cartTotalElem.textContent = `$${total.toFixed(2)}`;
}

// Finalizar venta (Checkout)
btnCheckout.addEventListener('click', async () => {
    checkoutMessage.textContent = '';
    if (cart.length === 0) {
        checkoutMessage.textContent = 'El carrito está vacío.';
        return;
    }

    const user = auth.currentUser;
    if (!user) {
        checkoutMessage.textContent = 'Debes iniciar sesión para finalizar la venta.';
        return;
    }

    try {
        // 1. Crear el registro de la venta en la colección 'sales'
        const saleData = {
            soldBy: user.uid,
            soldByEmail: user.email, // Guardar el email del vendedor
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            items: cart.map(item => ({
                productId: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                itemTotal: item.price * item.quantity
            })),
            totalAmount: parseFloat(cartTotalElem.textContent.replace('$', '')),
            status: 'completed' // Opcional: estado de la venta
        };

        await db.collection("sales").add(saleData);
        console.log("Venta registrada con éxito!");

        // 2. Actualizar el stock de los productos vendidos
        const batch = db.batch(); // Usar un batch para operaciones atómicas

        for (const item of cart) {
            const productRef = db.collection("products").doc(item.id);
            const currentProduct = products.find(p => p.id === item.id);

            if (currentProduct && currentProduct.stock >= item.quantity) {
                batch.update(productRef, {
                    stock: currentProduct.stock - item.quantity
                });
            } else {
                // Esto debería ser capturado antes por la lógica de añadir al carrito
                console.warn(`Advertencia: Stock insuficiente para ${item.name} (${item.stock} vs ${item.quantity}).`);
                checkoutMessage.textContent = `Error: Stock insuficiente para ${item.name}.`;
                // Puedes optar por revertir el batch o manejar el error de otra forma
                return; // Detener la operación si hay stock insuficiente
            }
        }

        await batch.commit(); // Ejecutar todas las actualizaciones de stock
        console.log("Inventario actualizado con éxito!");

        // 3. Limpiar carrito y recargar productos
        cart = [];
        updateCartDisplay();
        loadProducts(); // Recargar productos para reflejar el nuevo stock
        checkoutMessage.textContent = 'Venta completada y stock actualizado.';
        checkoutMessage.style.color = 'green';
        setTimeout(() => checkoutMessage.textContent = '', 3000); // Limpiar mensaje

    } catch (error) {
        console.error("Error al finalizar la venta: ", error);
        checkoutMessage.textContent = `Error al finalizar la venta: ${error.message}`;
        checkoutMessage.style.color = 'red';
    }
});

// Inicializar la vista del carrito al cargar la página
document.addEventListener('DOMContentLoaded', updateCartDisplay);
