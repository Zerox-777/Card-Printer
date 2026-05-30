// ===========================
// URL ROUTER - Xử lý routing
// ===========================

const DEFAULT_ROUTE = '/dashboard';

function navigateTo(route) {
    window.location.hash = '#' + route;
}

function parseRoute() {
    const hash = window.location.hash.slice(1) || DEFAULT_ROUTE;
    const [path, queryString] = hash.split('?');
    
    const params = {};
    if (queryString) {
        queryString.split('&').forEach(param => {
            const [key, value] = param.split('=');
            params[key] = decodeURIComponent(value || '');
        });
    }
    
    return { route: path || '/', params };
}

function renderRoute() {
    const { route, params } = parseRoute();
    
    // Ẩn tất cả các trang
    document.querySelectorAll('.page').forEach(page => {
        page.style.display = 'none';
    });
    
    if (route === '/dashboard') {
        document.getElementById('dashboard').style.display = 'block';
        document.title = 'Card Printer';
        if (typeof loadDeckList === 'function') loadDeckList();
    } 
    else if (route === '/editor') {
        document.getElementById('editor').style.display = 'block';

        if (params.id) {
            // Mở deck cũ: editDeck đã load data, router chỉ cần set title
            const deckName = params.name || 'Unnamed Deck';
            document.title = `Editor: ${deckName}`;
        } else {
            // Tạo deck mới
            document.title = 'Deck Editor';
            if (typeof createNewDeck === 'function') {
                createNewDeck(params.type || 'S');
            }
        }
    } 
    else {
        navigateTo(DEFAULT_ROUTE);
    }
    
    window.scrollTo(0, 0);
}

window.addEventListener('hashchange', renderRoute);
window.addEventListener('DOMContentLoaded', () => { renderRoute(); });