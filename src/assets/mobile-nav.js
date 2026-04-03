/**
 * Mobile Navigation Script - Unified Component
 * Handles: Active state, scroll collapse, menu toggling, scroll to top
 */

document.addEventListener("DOMContentLoaded", function() {
    // ── Footer year ──
    const yearEl = document.getElementById("tgb-year");
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }

    // ── Mobile nav active state ──
    const currentPath = window.location.pathname;
    const currentHref = window.location.href;

    function setActive(id) {
        document.querySelectorAll('.tgb-nav-item').forEach(el => el.classList.remove('active'));
        const el = document.getElementById(id);
        if (el) el.classList.add('active');
    }

    // Determine which nav item should be active
    if (currentPath === "/" || currentPath === "" || (currentHref.includes("greenborder.org/") && !currentHref.includes("greenborder.org/b") && !currentHref.includes("greenborder.org/n") && !currentHref.includes("greenborder.org/s") && !currentHref.includes("greenborder.org/a"))) {
        setActive('nav-home');
    } else if (currentHref.includes("news")) {
        setActive('nav-news');
    } else if (currentHref.includes("data") || currentHref.includes("sales")) {
        setActive('nav-data');
    } else if (currentHref.includes("education")) {
        setActive('nav-edu');
    } else if (currentHref.includes("about") || currentHref.includes("partnership")) {
        setActive('nav-about');
    }

    // Handle nav item clicks
    document.querySelectorAll('.tgb-nav-item').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('.tgb-nav-item').forEach(el => el.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // ── Collapse on scroll ──
    const navMenu = document.getElementById('tgb-mobile-menu');
    let isNavExpanded = true;

    window.addEventListener("scroll", function() {
        let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        if (window.innerWidth <= 768) {
            if (scrollTop > 50) {
                if (isNavExpanded) {
                    navMenu.classList.add('nav-collapsed');
                    isNavExpanded = false;
                }
            } else if (scrollTop < 10) {
                navMenu.classList.remove('nav-collapsed');
                isNavExpanded = true;
            }
        }

        // Back to top button
        const scrollBtn = document.getElementById("tgb-scroll-btn");
        if (window.scrollY > 300) {
            scrollBtn.classList.add("show");
        } else {
            scrollBtn.classList.remove("show");
        }
    }, { passive: true });

    // ── Tap collapsed menu to expand ──
    navMenu.addEventListener('click', function(e) {
        if (navMenu.classList.contains('nav-collapsed')) {
            e.preventDefault();
            navMenu.classList.remove('nav-collapsed');
            isNavExpanded = true;
        }
    });
});

// ── Scroll to top ──
function tgbScrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
