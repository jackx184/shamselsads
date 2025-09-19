function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function for better performance
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// Global Variables
let currentYear = '';
let currentData = null;
let currentSubject = '';
let currentTeacher = null;
let currentClass = '';
let currentLectureIndex = 0;
let currentLectures = [];
let navigationHistory = [];

// localStorage keys
const STORAGE_KEYS = {
    FAVORITES: 'caven_favorites',
    COMPLETED: 'caven_completed',
    SELECTED_YEAR: 'caven_selected_year'
};

// Initialize the app with performance optimization
document.addEventListener('DOMContentLoaded', function() {
    // Wait for all scripts to load before initializing
    requestAnimationFrame(() => {
        setTimeout(() => {
            initializeApp();
            // Preload HLS.js for better performance
            if (typeof Hls !== 'undefined') {
                console.log('HLS.js loaded successfully');
            }
        }, 50);
    });
    
    // Add viewport meta tag if not present for better mobile performance
    if (!document.querySelector('meta[name="viewport"]')) {
        const viewport = document.createElement('meta');
        viewport.name = 'viewport';
        viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes';
        document.head.appendChild(viewport);
    }
});

function initializeApp() {
    // Add a delay to ensure all data files are loaded
    setTimeout(() => {
        // Check if data is loaded
        if (typeof teacherData2025 === 'undefined' || typeof teacherData2026 === 'undefined') {
            console.error('Teacher data not loaded. Please check if data files are properly included.');
            showToast('جاري تحميل البيانات، يرجى الانتظار...', 'info');
            // Retry after another delay
            setTimeout(() => {
                if (typeof teacherData2025 === 'undefined' || typeof teacherData2026 === 'undefined') {
                    showToast('خطأ في تحميل البيانات. يرجى إعادة تحميل الصفحة.', 'error');
                } else {
                    initializeAppData();
                }
            }, 2000);
            return;
        }
        
        initializeAppData();
    }, 500);
}

function initializeAppData() {
    // Load saved year if exists and is valid
    const savedYear = getFromStorage(STORAGE_KEYS.SELECTED_YEAR);
    if (savedYear && (savedYear === '2025' || savedYear === '2026')) {
        selectYear(savedYear);
    } else {
        // Clear invalid saved year
        localStorage.removeItem(STORAGE_KEYS.SELECTED_YEAR);
        showHome();
    }
}

// Storage Functions
function saveToStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        showToast('خطأ في حفظ البيانات', 'error');
    }
}

function getFromStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('Error loading from localStorage:', error);
        return [];
    }
}

// Navigation Functions - Fixed showHome
function showHome() {
    // تنظيف الفيديو أولاً قبل إخفاء الصفحات
    cleanupVideoPlayer();
    
    hideAllPages();
    document.getElementById('home-page').classList.add('active');
    document.getElementById('breadcrumb').style.display = 'none';
    navigationHistory = [];
    currentYear = '';
    currentData = null;
    
    console.log('Returned to home and cleaned up video');
}

function hideAllPages() {
    // تنظيف شامل للفيديو عند الخروج من صفحة المشغل
    const currentPlayerPage = document.getElementById('player-page');
    if (currentPlayerPage && currentPlayerPage.classList.contains('active')) {
        console.log('Leaving player page - cleaning up video');
        cleanupVideoPlayer();
    }
    
    // إخفاء جميع الصفحات
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));
    
    // إخفاء عناصر التحميل
    const loadingElements = document.querySelectorAll('.loading-indicator, .spinner');
    loadingElements.forEach(el => {
        if (el) el.style.display = 'none';
    });
}

function goBack() {
    // Clean up video if leaving player page
    const currentPlayerPage = document.getElementById('player-page');
    if (currentPlayerPage && currentPlayerPage.classList.contains('active')) {
        const video = document.getElementById('video-player');
        if (video) {
            video.pause();
            video.currentTime = 0;
        }
        cleanupVideoPlayer();
    }
    
    if (navigationHistory.length > 0) {
        const previousState = navigationHistory.pop();
        switch (previousState.type) {
            case 'subjects':
                showSubjects(previousState.data);
                break;
            case 'teachers':
                showTeachers(previousState.subject, previousState.data);
                break;
            case 'classes':
                showClasses(previousState.teacher, previousState.data);
                break;
            case 'lectures':
                showLectures(previousState.teacher, previousState.className, previousState.data);
                break;
            default:
                showHome();
        }
    } else {
        showHome();
    }
}

function updateBreadcrumb(items) {
    const breadcrumb = document.getElementById('breadcrumb');
    breadcrumb.innerHTML = '';
    
    items.forEach((item, index) => {
        const span = document.createElement('span');
        span.className = 'breadcrumb-item';
        span.textContent = item.text;
        
        if (item.onclick) {
            span.onclick = () => {
                // تنظيف الفيديو قبل التنقل
                const currentPlayerPage = document.getElementById('player-page');
                if (currentPlayerPage && currentPlayerPage.classList.contains('active')) {
                    cleanupVideoPlayer();
                }
                
                // استدعاء الدالة الأصلية
                item.onclick();
            };
        }
        
        breadcrumb.appendChild(span);
    });
    
    breadcrumb.style.display = 'block';
}

// Year Selection
function selectYear(year) {
    showLoading();
    currentYear = year;
    
    setTimeout(() => {
        try {
            if (year === '2025') {
                if (typeof teacherData2025 === 'undefined') {
                    throw new Error('teacherData2025 is not defined');
                }
                currentData = teacherData2025;
            } else if (year === '2026') {
                if (typeof teacherData2026 === 'undefined') {
                    throw new Error('teacherData2026 is not defined');
                }
                currentData = teacherData2026;
            }
            
            if (!currentData || !currentData.teachers) {
                throw new Error('Invalid data structure');
            }
            
            saveToStorage(STORAGE_KEYS.SELECTED_YEAR, year);
            showSubjects(currentData);
        } catch (error) {
            console.error('Error selecting year:', error);
            showToast('خطأ في تحميل بيانات السنة المختارة', 'error');
            showHome();
        } finally {
            hideLoading();
        }
    }, 500);
}

// Show Subjects with performance optimization
function showSubjects(data) {
    hideAllPages();
    document.getElementById('subjects-page').classList.add('active');
    
    if (!data || !data.teachers || !Array.isArray(data.teachers)) {
        console.error('Invalid data structure in showSubjects:', data);
        showToast('خطأ في هيكل البيانات', 'error');
        showHome();
        return;
    }
    
    const subjects = getUniqueSubjects(data.teachers);
    const container = document.getElementById('subjects-container');
    
    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    container.innerHTML = '';
    
    subjects.forEach(subject => {
        const teacherCount = data.teachers.filter(t => t.subject === subject).length;
        const lectureCount = getTotalLecturesForSubject(data.teachers, subject);
        
        const card = document.createElement('div');
        card.className = 'subject-card';
        card.onclick = () => {
            navigationHistory.push({ type: 'subjects', data: data });
            showTeachers(subject, data);
        };
        
        card.innerHTML = `
            <div class="subject-icon">
                <i class="${getSubjectIcon(subject)}"></i>
            </div>
            <h3>${subject}</h3>
            <div class="subject-stats">
                <div class="stat">
                    <span class="stat-number">${teacherCount}</span>
                    <span class="stat-label">مدرس</span>
                </div>
                <div class="stat">
                    <span class="stat-number">${lectureCount}</span>
                    <span class="stat-label">محاضرة</span>
                </div>
            </div>
        `;
        
        fragment.appendChild(card);
    });
    
    // Append all at once for better performance
    container.appendChild(fragment);
    
    updateBreadcrumb([
        { text: 'الرئيسية', onclick: () => showHome() },
        { text: `محاضرات ${currentYear}` }
    ]);
}

function getUniqueSubjects(teachers) {
    const subjects = teachers.map(teacher => {
        // Remove "مدرس مادة" prefix to show only the subject name
        return teacher.subject.replace(/^مدرس مادة\s+/, '');
    });
    return [...new Set(subjects)];
}

function getTotalLecturesForSubject(teachers, subject) {
    return teachers
        .filter(teacher => {
            // Match both full subject name and cleaned subject name
            const cleanedSubject = teacher.subject.replace(/^مدرس مادة\s+/, '');
            return teacher.subject === subject || cleanedSubject === subject;
        })
        .reduce((total, teacher) => {
            return total + teacher.classes.reduce((classTotal, cls) => {
                return classTotal + cls.lectures.length;
            }, 0);
        }, 0);
}

function getSubjectIcon(subject) {
    // Clean subject name and match icons
    const cleanSubject = subject.replace(/^مدرس مادة\s+/, '');
    
    const icons = {
        'التربية الاسلامية': 'fas fa-mosque',
        'الاحياء': 'fas fa-microscope',
        'الفيزياء': 'fas fa-atom',
        'الكيمياء': 'fas fa-flask',
        'الرياضيات': 'fas fa-calculator',
        'اللغة العربية': 'fas fa-book-open',
        'اللغة الانجليزية': 'fas fa-globe'
    };
    
    return icons[cleanSubject] || icons[subject] || 'fas fa-book';
}

// Show Teachers with performance optimization
function showTeachers(subject, data) {
    hideAllPages();
    document.getElementById('teachers-page').classList.add('active');
    currentSubject = subject;
    
    const teachers = data.teachers.filter(teacher => {
        // Match both full subject name and cleaned subject name
        const cleanedSubject = teacher.subject.replace(/^مدرس مادة\s+/, '');
        return teacher.subject === subject || cleanedSubject === subject;
    });
    const container = document.getElementById('teachers-container');
    
    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    container.innerHTML = '';
    
    const favorites = getFromStorage(STORAGE_KEYS.FAVORITES);
    const completed = getFromStorage(STORAGE_KEYS.COMPLETED);
    
    teachers.forEach(teacher => {
        const totalLectures = teacher.classes.reduce((total, cls) => total + cls.lectures.length, 0);
        const completedLectures = getCompletedLecturesForTeacher(teacher, completed);
        const isFavorite = favorites.includes(teacher.id);
        
        const card = document.createElement('div');
        card.className = 'teacher-card';
        card.onclick = (e) => {
            if (!e.target.closest('.teacher-actions')) {
                navigationHistory.push({ type: 'teachers', subject: subject, data: data });
                showClasses(teacher, data);
            }
        };
        
        card.innerHTML = `
            <img src="${teacher.image}" alt="${teacher.name}" class="teacher-avatar" onerror="this.src='https://via.placeholder.com/60x60/667eea/white?text=مدرس'">
            <h3 class="teacher-name">${teacher.name}</h3>
            <p class="teacher-subject">${teacher.subject}</p>
            <div class="teacher-stats">
                <div class="stat">
                    <span class="stat-number">${totalLectures}</span>
                    <span class="stat-label">محاضرة</span>
                </div>
                <div class="stat">
                    <span class="stat-number">${completedLectures}</span>
                    <span class="stat-label">مكتملة</span>
                </div>
            </div>
            <div class="teacher-actions">
                <button class="btn-star ${isFavorite ? 'active' : ''}" onclick="toggleFavorite(${teacher.id})">
                    <i class="fas fa-star"></i>
                </button>
            </div>
        `;
        
        fragment.appendChild(card);
    });
    
    // Append all at once for better performance
    container.appendChild(fragment);
    
    updateBreadcrumb([
        { text: 'الرئيسية', onclick: () => showHome() },
        { text: `محاضرات ${currentYear}`, onclick: () => showSubjects(data) },
        { text: subject.replace(/^مدرس مادة\s+/, '') }
    ]);
}

function getCompletedLecturesForTeacher(teacher, completedLectures) {
    let count = 0;
    teacher.classes.forEach(cls => {
        cls.lectures.forEach(lecture => {
            const lectureId = generateLectureId(teacher.id, cls.name, lecture.title);
            if (completedLectures.includes(lectureId)) {
                count++;
            }
        });
    });
    return count;
}

// Show Classes
function showClasses(teacher, data) {
    hideAllPages();
    document.getElementById('classes-page').classList.add('active');
    currentTeacher = teacher;
    
    const container = document.getElementById('classes-container');
    container.innerHTML = '';
    
    const completed = getFromStorage(STORAGE_KEYS.COMPLETED);
    
    teacher.classes.forEach(cls => {
        const completedLectures = cls.lectures.filter(lecture => {
            const lectureId = generateLectureId(teacher.id, cls.name, lecture.title);
            return completed.includes(lectureId);
        }).length;
        
        // Handle empty classes
        const totalLectures = cls.lectures.length;
        let progressText = '';
        let progressPercentage = '';
        
        if (totalLectures === 0) {
            progressText = 'قريباً';
            progressPercentage = 'لا تتوفر محاضرات';
        } else {
            progressText = `${completedLectures}/${totalLectures}`;
            progressPercentage = `${Math.round((completedLectures / totalLectures) * 100)}%`;
        }
        
        const card = document.createElement('div');
        card.className = 'class-card';
        
        // Only make clickable if there are lectures
        if (totalLectures > 0) {
            card.onclick = () => {
                navigationHistory.push({ type: 'classes', teacher: teacher, data: data });
                showLectures(teacher, cls.name, data);
            };
        } else {
            card.style.opacity = '0.7';
            card.style.cursor = 'not-allowed';
        }
        
        card.innerHTML = `
            <div class="class-header">
                <h3>${cls.name}</h3>
                <div class="class-progress">
                    <span>${progressText}</span>
                </div>
            </div>
            <div class="class-stats">
                <div class="stat">
                    <span class="stat-number">${totalLectures}</span>
                    <span class="stat-label">محاضرة</span>
                </div>
                <div class="stat">
                    <span class="stat-number">${totalLectures > 0 ? completedLectures : 'قريباً'}</span>
                    <span class="stat-label">${totalLectures > 0 ? 'مكتملة' : ''}</span>
                </div>
                <div class="stat">
                    <span class="stat-number">${progressPercentage}</span>
                    <span class="stat-label">${totalLectures > 0 ? 'التقدم' : ''}</span>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
    
    updateBreadcrumb([
        { text: 'الرئيسية', onclick: () => showHome() },
        { text: `محاضرات ${currentYear}`, onclick: () => showSubjects(data) },
        { text: currentSubject.replace(/^مدرس مادة\s+/, ''), onclick: () => showTeachers(currentSubject, data) },
        { text: teacher.name }
    ]);
}

// Show Lectures
function showLectures(teacher, className, data) {
    hideAllPages();
    document.getElementById('lectures-page').classList.add('active');
    currentClass = className;
    
    const classData = teacher.classes.find(cls => cls.name === className);
    const container = document.getElementById('lectures-container');
    container.innerHTML = '';
    
    // Show teacher info
    const teacherInfo = document.getElementById('teacher-info');
    teacherInfo.innerHTML = `
        <div class="teacher-details">
            <img src="${teacher.image}" alt="${teacher.name}" id="teacher-avatar" onerror="this.src='https://via.placeholder.com/60x60/667eea/white?text=مدرس'">
            <div>
                <h3>${teacher.name}</h3>
                <p>${teacher.subject}</p>
            </div>
        </div>
    `;
    
    const completed = getFromStorage(STORAGE_KEYS.COMPLETED);
    
    classData.lectures.forEach((lecture, index) => {
        const lectureId = generateLectureId(teacher.id, className, lecture.title);
        const isCompleted = completed.includes(lectureId);
        
        const card = document.createElement('div');
        card.className = `lecture-card ${isCompleted ? 'completed' : ''}`;
        card.onclick = (e) => {
            if (!e.target.closest('.btn-check')) {
                currentLectures = classData.lectures;
                currentLectureIndex = index;
                playLecture(lecture, teacher);
            }
        };
        
        card.innerHTML = `
            <div class="lecture-header">
                <h3 class="lecture-title">${lecture.title}</h3>
                <button class="btn-check ${isCompleted ? 'completed' : ''}" onclick="event.stopPropagation(); toggleLectureCompletion('${lectureId}', this)">
                    <i class="fas fa-check"></i>
                </button>
            </div>
            <p class="lecture-description">${lecture.description}</p>
            <div class="lecture-footer">
                <span class="lecture-duration">
                    <i class="fas fa-play-circle"></i> مشاهدة المحاضرة
                </span>
            </div>
        `;
        
        container.appendChild(card);
    });
    
    updateBreadcrumb([
        { text: 'الرئيسية', onclick: () => showHome() },
        { text: `محاضرات ${currentYear}`, onclick: () => showSubjects(data) },
        { text: currentSubject.replace(/^مدرس مادة\s+/, ''), onclick: () => showTeachers(currentSubject, data) },
        { text: teacher.name, onclick: () => showClasses(teacher, data) },
        { text: className }
    ]);
}

// Generate unique lecture ID
function generateLectureId(teacherId, className, lectureTitle) {
    return `${teacherId}-${className}-${lectureTitle}`.replace(/\s+/g, '-');
}

// Generate unique key for video progress
function generateUniqueKey(url) {
    // Create a simple hash from the URL
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
        const char = url.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString();
}

// Update lecture status function
function updateLectureStatus(lectureKey, isCompleted) {
    if (isCompleted) {
        localStorage.setItem(lectureKey, 'completed');
        showToast('تم إكمال المحاضرة!', 'success');
    }
}

// Cleanup function - Enhanced with complete cleanup
function cleanupVideoPlayer() {
    console.log('Cleaning up video player...');
    
    // تنظيف HLS
    if (window.currentHls) {
        try {
            window.currentHls.destroy();
        } catch(e) {
            console.log('Error destroying HLS:', e);
        }
        window.currentHls = null;
    }
    
    // تنظيف الفترة الزمنية للحفظ
    if (window.currentSaveInterval) {
        clearInterval(window.currentSaveInterval);
        window.currentSaveInterval = null;
    }
    
    // تنظيف مشغل Plyr
    if (window.player) {
        try {
            if (window.player.pause) {
                window.player.pause();
            }
            if (window.player.destroy) {
                window.player.destroy();
            }
        } catch(e) {
            console.log('Error destroying Plyr player:', e);
        }
        window.player = null;
    }
    
    // تنظيف عنصر الفيديو
    const video = document.getElementById('player') || document.getElementById('video-player');
    if (video) {
        try {
            video.pause();
            video.removeAttribute('src');
            video.load();
            // إزالة جميع event listeners
            video.onloadedmetadata = null;
            video.onended = null;
            video.onerror = null;
        } catch(e) {
            console.log('Error cleaning video element:', e);
        }
    }
    
    // تنظيف iframe
    const iframe = document.getElementById('current-iframe');
    if (iframe) {
        try {
            iframe.src = 'about:blank';
            setTimeout(() => {
                if (iframe.parentNode) {
                    iframe.parentNode.removeChild(iframe);
                }
            }, 100);
        } catch(e) {
            console.log('Error cleaning iframe:', e);
        }
    }
    
    // تنظيف شامل للحاويات
    const containers = [
        document.querySelector('.video-player-container'),
        document.querySelector('.video-wrapper'),
        document.getElementById('video-player')?.parentElement
    ];
    
    containers.forEach(container => {
        if (container && container.innerHTML && 
            (container.innerHTML.includes('video') || container.innerHTML.includes('iframe'))) {
            try {
                // إيقاف جميع الوسائط في الحاوي
                const videos = container.querySelectorAll('video');
                videos.forEach(v => {
                    v.pause();
                    v.removeAttribute('src');
                    v.load();
                });
                
                const iframes = container.querySelectorAll('iframe');
                iframes.forEach(iframe => {
                    iframe.src = 'about:blank';
                });
                
            } catch(e) {
                console.log('Error cleaning container:', e);
            }
        }
    });
    
    console.log('Video player cleanup completed');
}

// Call cleanup when leaving the page
window.addEventListener('beforeunload', cleanupVideoPlayer);
window.addEventListener('pagehide', cleanupVideoPlayer);

// Add cleanup for browser back/forward buttons
window.addEventListener('popstate', () => {
    const video = document.getElementById('video-player');
    if (video) {
        video.pause();
        video.currentTime = 0;
    }
    cleanupVideoPlayer();
});

// Play Lecture - Simplified (No Custom Controls)
// إصلاح مشكلة عرض الفيديو - استبدل دالة playLecture بهذه
function playLecture(lecture, teacher) {
    hideAllPages();
    document.getElementById('player-page').classList.add('active');
    
    // البحث عن الحاوي الصحيح أو إنشاؤه
    let container = document.querySelector('.video-player-container') || 
                   document.querySelector('.video-wrapper') || 
                   document.getElementById('video-player')?.parentElement;
    
    // إذا لم يوجد الحاوي، ابحث في صفحة المشغل
    if (!container) {
        const playerPage = document.getElementById('player-page');
        container = playerPage.querySelector('.video-container') || 
                   playerPage.querySelector('[class*="video"]') ||
                   playerPage.querySelector('div');
        
        // إنشاء حاوي جديد إذا لم يوجد
        if (!container) {
            container = document.createElement('div');
            container.className = 'video-player-container';
            container.style.cssText = `
                width: 100%; 
                max-width: 100%; 
                position: relative; 
                background: #000;
                min-height: 400px;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            playerPage.appendChild(container);
        }
    }
    
    const FORCED_REFERER = 'https://abwaab.com';
    
    const isHLS = lecture.url.includes('.m3u8');
    const uniqueKey = generateUniqueKey(lecture.url);
    const storageKey = `${uniqueKey}-progress`;
    const durationKey = `${uniqueKey}-duration`;

    // تنظيف شامل لأي تشغيل سابق
    cleanupVideoPlayer();

    // تنظيف الحاوي بالكامل
    container.innerHTML = '';
    container.style.display = 'block';
    container.style.visibility = 'visible';

    // ✅ iframe handling
    if (lecture.url.includes("iframe.mediadelivery.net/embed/") || lecture.url.includes("iframe")) {
        const iframeUrl = `https://22proxxy.eduiraq.my/proxy?url=${encodeURIComponent(lecture.url)}&referer=${encodeURIComponent(FORCED_REFERER)}`;
        
        container.innerHTML = `
            <div style="position: relative; width: 100%; padding-top: 56.25%; background: #000; overflow: hidden; border-radius: 8px;">
                <iframe 
                    id="current-iframe"
                    src="${iframeUrl}" 
                    allowfullscreen 
                    loading="eager"
                    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; border-radius: 8px; display: block;"
                    referrerpolicy="no-referrer-when-downgrade"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen">
                </iframe>
            </div>
        `;
        
        console.log('iframe created successfully');
    } else {
        // ✅ Regular video - إصلاح العرض
        container.innerHTML = `
            <div style="position: relative; width: 100%; max-width: 100%; background: #000; border-radius: 8px; overflow: hidden;">
                <video 
                    id="player" 
                    playsinline 
                    controls 
                    preload="metadata"
                    style="
                        width: 100% !important; 
                        height: auto !important; 
                        max-width: 100% !important;
                        display: block !important; 
                        visibility: visible !important;
                        opacity: 1 !important;
                        background: #000;
                        object-fit: contain;
                        min-height: 300px;
                    "
                    onloadstart="console.log('Video loading started')"
                    onloadeddata="console.log('Video data loaded')"
                    oncanplay="console.log('Video can play')"
                >
                    <p style="color: white; text-align: center; padding: 20px;">متصفحك لا يدعم عرض الفيديو.</p>
                </video>
            </div>
        `;
        
        const videoElement = document.getElementById('player');
        
        if (!videoElement) {
            showToast('خطأ في إنشاء مشغل الفيديو', 'error');
            return;
        }

        // إجبار ظهور الفيديو
        videoElement.style.display = 'block';
        videoElement.style.visibility = 'visible';
        videoElement.style.opacity = '1';

        // التأكد من أن Plyr متوفر قبل الاستخدام
        let usingPlyr = false;
        if (typeof Plyr !== 'undefined') {
            try {
                // إنشاء مشغل Plyr
                window.player = new Plyr('#player', {
                    seekTime: 10,
                    controls: [
                        'play-large', 'rewind', 'play', 'fast-forward', 'progress',
                        'current-time', 'mute', 'volume', 'settings', 'fullscreen'
                    ],
                    settings: ['speed'],
                    speed: { selected: 1, options: [1, 1.25, 1.5, 2] },
                    autoplay: false,
                    preload: 'metadata',
                    fullscreen: { enabled: true, fallback: true, iosNative: true },
                    ratio: '16:9' // إضافة نسبة العرض
                });
                
                usingPlyr = true;
                console.log('Plyr player created successfully');
                
                // إجبار إعادة تحميل Plyr
                setTimeout(() => {
                    if (window.player && window.player.media) {
                        window.player.media.style.display = 'block';
                        window.player.media.style.visibility = 'visible';
                    }
                }, 100);
                
            } catch(e) {
                console.log('Plyr creation failed, using native controls:', e);
                videoElement.controls = true;
            }
        } else {
            console.log('Plyr not available, using native controls');
            videoElement.controls = true;
        }

        function setupMetadata() {
            videoElement.onloadedmetadata = () => {
                console.log('Video metadata loaded');
                const duration = videoElement.duration;
                if (!isNaN(duration) && duration > 0) {
                    localStorage.setItem(durationKey, duration.toFixed(1));
                }

                const savedTime = localStorage.getItem(storageKey);
                if (savedTime && savedTime !== 'completed') {
                    const time = parseFloat(savedTime);
                    if (!isNaN(time) && time > 0) {
                        videoElement.currentTime = time;
                    }
                }

                // إجبار إعادة رسم الفيديو
                videoElement.style.display = 'block';
                videoElement.style.visibility = 'visible';
            };

            videoElement.oncanplay = () => {
                console.log('Video can play - forcing display');
                videoElement.style.display = 'block';
                videoElement.style.visibility = 'visible';
                videoElement.style.opacity = '1';
            };

            videoElement.onplaying = () => {
                console.log('Video is playing');
                videoElement.style.display = 'block';
                videoElement.style.visibility = 'visible';
            };

            const saveInterval = setInterval(() => {
                if (!videoElement.paused && !videoElement.ended && videoElement.currentTime > 0) {
                    localStorage.setItem(storageKey, videoElement.currentTime.toFixed(1));
                }
            }, 2000);

            videoElement.onended = () => {
                clearInterval(saveInterval);
                localStorage.setItem(storageKey, 'completed');
                updateLectureStatus(storageKey, true);
                
                // Auto play next lecture
                setTimeout(() => {
                    if (currentLectureIndex < currentLectures.length - 1) {
                        playNextLecture();
                    }
                }, 2000);
            };

            window.currentSaveInterval = saveInterval;
        }

        function playWithProxyHLS(cleanedUrl) {
            const proxiedUrl = `https://proxy.eduiraq.my/proxy?url=${encodeURIComponent(cleanedUrl)}&referer=${encodeURIComponent(FORCED_REFERER)}`;

            if (typeof Hls === 'undefined') {
                showToast('مكتبة HLS غير متوفرة', 'error');
                return;
            }

            const hls = new Hls({
                xhrSetup: function (xhr, originalUrl) {
                    const isAlreadyProxied = originalUrl.includes("proxy.eduiraq.my");
                    const finalUrl = isAlreadyProxied
                        ? originalUrl
                        : `https://proxy.eduiraq.my/proxy?url=${encodeURIComponent(originalUrl)}&referer=${encodeURIComponent(FORCED_REFERER)}`;

                    xhr.open('GET', finalUrl, true);
                    xhr.setRequestHeader('Referer', FORCED_REFERER);
                    xhr.setRequestHeader('Origin', 'https://abwaab.com');
                }
            });

            window.currentHls = hls;
            hls.loadSource(proxiedUrl);
            hls.attachMedia(videoElement);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log('HLS manifest parsed');
                setupMetadata();
                // محاولة التشغيل التلقائي
                videoElement.play().catch(e => {
                    console.log('HLS autoplay failed:', e);
                    showToast('اضغط على تشغيل لبدء المحاضرة', 'info');
                });
            });

            hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) {
                    hls.destroy();
                    console.warn("❌ HLS Fatal Error:", data);
                    showToast('فشل في تحميل الفيديو', 'error');
                }
            });
        }

        function tryPlayHLS() {
            if (typeof Hls === 'undefined' || !Hls.isSupported()) {
                tryPlayMP4();
                return;
            }

            // تجربة بدون بروكسي أولاً
            const directHls = new Hls();
            window.currentHls = directHls;

            directHls.loadSource(lecture.url);
            directHls.attachMedia(videoElement);

            let errored = false;

            directHls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log('Direct HLS manifest parsed');
                setupMetadata();
                videoElement.play().catch(() => {
                    if (!errored) {
                        errored = true;
                        directHls.destroy();
                        tryProxy();
                    }
                });
            });

            directHls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal && !errored) {
                    errored = true;
                    directHls.destroy();
                    tryProxy();
                }
            });

            function tryProxy() {
                // تنظيف الرابط إذا كان فيه بروكسي مكرر
                let cleanUrl = lecture.url;
                try {
                    const parsed = new URL(lecture.url);
                    if (parsed.hostname.includes("proxy.eduiraq.my") && parsed.searchParams.has("url")) {
                        cleanUrl = decodeURIComponent(parsed.searchParams.get("url"));
                    }
                } catch (e) {
                    console.warn("❌ Failed to clean nested proxy URL:", e.message);
                }

                playWithProxyHLS(cleanUrl);
            }
        }

        function tryPlayMP4() {
            console.log('Attempting MP4 playback');
            
            // تجربة تشغيل مباشر أولاً
            videoElement.src = lecture.url;

            const handleError = () => {
                console.log('Direct MP4 failed, trying proxy');
                // فشل، جرب البروكسي
                const proxiedUrl = `https://proxy.eduiraq.my/proxy?url=${encodeURIComponent(lecture.url)}&referer=${encodeURIComponent(FORCED_REFERER)}`;
                videoElement.src = proxiedUrl;
                
                videoElement.onerror = () => {
                    console.error("❌ Failed to load MP4 with proxy");
                    showToast('فشل في تحميل الفيديو', 'error');
                };
                
                setupMetadata();
            };

            videoElement.onerror = handleError;
            
            setupMetadata();
            
            // محاولة التشغيل مع معالجة الأخطاء
            videoElement.play().catch((error) => {
                console.log('MP4 play failed:', error);
                handleError();
            });
        }

        // تحديد نوع الفيديو وتشغيله
        setTimeout(() => {
            if (isHLS) {
                tryPlayHLS();
            } else {
                tryPlayMP4();
            }
        }, 100);
    }
    
    // باقي الكود يبقى كما هو...
    const lectureTitle = document.getElementById('lecture-title');
    const teacherName = document.getElementById('teacher-name');
    const teacherSubject = document.getElementById('teacher-subject');
    
    if (lectureTitle) lectureTitle.textContent = lecture.title;
    if (teacherName) teacherName.textContent = teacher.name;
    if (teacherSubject) teacherSubject.textContent = teacher.subject;
    
    // Set teacher avatar with proper error handling
    const teacherAvatar = document.getElementById('teacher-avatar');
    if (teacherAvatar) {
        teacherAvatar.src = '';
        teacherAvatar.onerror = function() {
            this.src = 'https://via.placeholder.com/60x60/667eea/white?text=مدرس';
            this.onerror = null;
        };
        
        if (teacher.image && teacher.image.trim() !== '') {
            teacherAvatar.src = teacher.image;
        } else {
            teacherAvatar.src = 'https://via.placeholder.com/60x60/667eea/white?text=مدرس';
        }
        
        teacherAvatar.style.display = 'block';
        teacherAvatar.style.visibility = 'visible';
    }
    
    // Update lecture description
    const lectureDescElement = document.querySelector('.lecture-description p');
    if (lectureDescElement) {
        const fullDescription = `
            ${lecture.description}<br><br>
            <div style="display:inline-flex;align-items:center;gap:0.3rem;font-size:1rem;line-height:1.4;">
                <span>📱 تابعنا على إنستغرام:</span>
                <a href="https://www.instagram.com/l1pll_" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;text-decoration:none;color:#e1306c;font-weight:600;">
                    <i class="fab fa-instagram" style="margin-left:0.3rem;"></i>@l1pll_
                </a>
            </div><br>
            <div style="margin-top:0.75rem;display:inline-flex;align-items:center;gap:0.3rem;font-size:1rem;font-weight:bold;line-height:1.4;">
                <span>📺 قناة المطور للمحاضرات المسربة:</span>
                <a href="https://t.me/allawi10_l" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;text-decoration:none;color:#0088cc;">
                    <i class="fab fa-telegram" style="margin-left:0.3rem;"></i>@allawi10_l
                </a>
            </div>
        `;
        lectureDescElement.innerHTML = fullDescription;
    }
    
    // Update buttons state
    if (typeof updatePlayerButtons === 'function') {
        updatePlayerButtons(lecture, teacher);
    }
    if (typeof updateNavigationButtons === 'function') {
        updateNavigationButtons();
    }
    
    // Add to navigation history
    navigationHistory.push({ 
        type: 'lectures', 
        teacher: teacher, 
        className: currentClass, 
        data: currentData 
    });
    
    console.log('playLecture completed successfully');
}

function updatePlayerButtons(lecture, teacher) {
    const lectureId = generateLectureId(teacher.id, currentClass, lecture.title);
    const completed = getFromStorage(STORAGE_KEYS.COMPLETED);
    const favorites = getFromStorage(STORAGE_KEYS.FAVORITES);
    
    const btnComplete = document.getElementById('btn-complete');
    const btnFavorite = document.getElementById('btn-favorite');
    
    if (completed.includes(lectureId)) {
        btnComplete.classList.add('completed');
        btnComplete.innerHTML = '<i class="fas fa-check"></i> تم الانتهاء';
    } else {
        btnComplete.classList.remove('completed');
        btnComplete.innerHTML = '<i class="fas fa-check"></i> تم الانتهاء';
    }
    
    if (favorites.includes(teacher.id)) {
        btnFavorite.classList.add('active');
        btnFavorite.innerHTML = '<i class="fas fa-star"></i> في المفضلة';
    } else {
        btnFavorite.classList.remove('active');
        btnFavorite.innerHTML = '<i class="fas fa-star"></i> إضافة للمفضلة';
    }
    
    // Store current lecture and teacher for button functions
    btnComplete.onclick = () => toggleCurrentLectureCompletion(lectureId);
    btnFavorite.onclick = () => toggleCurrentTeacherFavorite(teacher.id);
}

function updateNavigationButtons() {
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    
    btnPrev.disabled = currentLectureIndex === 0;
    btnNext.disabled = currentLectureIndex === currentLectures.length - 1;
}

// Favorites Functions
function toggleFavorite(teacherId) {
    const favorites = getFromStorage(STORAGE_KEYS.FAVORITES);
    const index = favorites.indexOf(teacherId);
    
    if (index > -1) {
        favorites.splice(index, 1);
        showToast('تم إزالة المدرس من المفضلة', 'success');
    } else {
        favorites.push(teacherId);
        showToast('تم إضافة المدرس للمفضلة', 'success');
    }
    
    saveToStorage(STORAGE_KEYS.FAVORITES, favorites);
    
    // Update UI
    const starBtn = event.target.closest('.btn-star');
    starBtn.classList.toggle('active');
}

function toggleCurrentTeacherFavorite(teacherId) {
    toggleFavorite(teacherId);
    updatePlayerButtons(currentLectures[currentLectureIndex], currentTeacher);
}

function showFavorites() {
    hideAllPages();
    document.getElementById('favorites-page').classList.add('active');
    
    const favorites = getFromStorage(STORAGE_KEYS.FAVORITES);
    const container = document.getElementById('favorites-container');
    container.innerHTML = '';
    
    if (favorites.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-star" style="font-size: 4rem; color: rgba(255, 255, 255, 0.3); margin-bottom: 1rem;"></i>
                <h3 style="color: #fff; margin-bottom: 1rem;">لا توجد مدرسين في المفضلة</h3>
                <p style="color: rgba(255, 255, 255, 0.8);">أضف مدرسينك المفضلين لسهولة الوصول إليهم</p>
            </div>
        `;
        return;
    }
    
    // Get all teachers from both years with error checking
    const allTeachers = [];
    
    if (typeof teacherData2025 !== 'undefined' && teacherData2025.teachers) {
        allTeachers.push(...teacherData2025.teachers);
    }
    
    if (typeof teacherData2026 !== 'undefined' && teacherData2026.teachers) {
        allTeachers.push(...teacherData2026.teachers);
    }
    
    if (allTeachers.length === 0) {
        showToast('خطأ في تحميل بيانات المدرسين', 'error');
        showHome();
        return;
    }
    
    const favoriteTeachers = allTeachers.filter(teacher => favorites.includes(teacher.id));
    const completed = getFromStorage(STORAGE_KEYS.COMPLETED);
    
    favoriteTeachers.forEach(teacher => {
        const totalLectures = teacher.classes.reduce((total, cls) => total + cls.lectures.length, 0);
        const completedLectures = getCompletedLecturesForTeacher(teacher, completed);
        
        const card = document.createElement('div');
        card.className = 'teacher-card';
        card.onclick = (e) => {
            if (!e.target.closest('.teacher-actions')) {
                try {
                    // Determine which year this teacher belongs to
                    let yearData = null;
                    let year = '';
                    
                    if (typeof teacherData2025 !== 'undefined' && teacherData2025.teachers && 
                        teacherData2025.teachers.some(t => t.id === teacher.id)) {
                        yearData = teacherData2025;
                        year = '2025';
                    } else if (typeof teacherData2026 !== 'undefined' && teacherData2026.teachers && 
                               teacherData2026.teachers.some(t => t.id === teacher.id)) {
                        yearData = teacherData2026;
                        year = '2026';
                    }
                    
                    if (!yearData) {
                        throw new Error('Could not find teacher data');
                    }
                    
                    currentYear = year;
                    currentData = yearData;
                    currentSubject = teacher.subject;
                    
                    navigationHistory.push({ type: 'favorites' });
                    showClasses(teacher, yearData);
                } catch (error) {
                    console.error('Error navigating from favorites:', error);
                    showToast('خطأ في الانتقال إلى المدرس', 'error');
                }
            }
        };
        
        card.innerHTML = `
            <img src="${teacher.image}" alt="${teacher.name}" class="teacher-avatar" onerror="this.src='https://via.placeholder.com/80x80/667eea/white?text=مدرس'">
            <h3 class="teacher-name">${teacher.name}</h3>
            <p class="teacher-subject">${teacher.subject}</p>
            <div class="teacher-stats">
                <div class="stat">
                    <span class="stat-number">${totalLectures}</span>
                    <span class="stat-label">محاضرة</span>
                </div>
                <div class="stat">
                    <span class="stat-number">${completedLectures}</span>
                    <span class="stat-label">مكتملة</span>
                </div>
            </div>
            <div class="teacher-actions">
                <button class="btn-star active" onclick="toggleFavorite(${teacher.id})">
                    <i class="fas fa-star"></i>
                </button>
            </div>
        `;
        
        container.appendChild(card);
    });
    
    updateBreadcrumb([
        { text: 'الرئيسية', onclick: () => showHome() },
        { text: 'المدرسين المفضلين' }
    ]);
}

// Lecture Completion Functions
function toggleLectureCompletion(lectureId, button) {
    const completed = getFromStorage(STORAGE_KEYS.COMPLETED);
    const index = completed.indexOf(lectureId);
    
    if (index > -1) {
        completed.splice(index, 1);
        button.classList.remove('completed');
        button.closest('.lecture-card').classList.remove('completed');
        showToast('تم إزالة علامة الانتهاء', 'success');
    } else {
        completed.push(lectureId);
        button.classList.add('completed');
        button.closest('.lecture-card').classList.add('completed');
        showToast('تم وضع علامة الانتهاء', 'success');
    }
    
    saveToStorage(STORAGE_KEYS.COMPLETED, completed);
}

function toggleCurrentLectureCompletion(lectureId) {
    const completed = getFromStorage(STORAGE_KEYS.COMPLETED);
    const index = completed.indexOf(lectureId);
    
    if (index > -1) {
        completed.splice(index, 1);
        showToast('تم إزالة علامة الانتهاء', 'success');
    } else {
        completed.push(lectureId);
        showToast('تم وضع علامة الانتهاء', 'success');
    }
    
    saveToStorage(STORAGE_KEYS.COMPLETED, completed);
    updatePlayerButtons(currentLectures[currentLectureIndex], currentTeacher);
}

// Navigation in Player
function playPreviousLecture() {
    if (currentLectureIndex > 0) {
        currentLectureIndex--;
        const lecture = currentLectures[currentLectureIndex];
        playLecture(lecture, currentTeacher);
        showToast('المحاضرة السابقة', 'success');
    }
}

function playNextLecture() {
    if (currentLectureIndex < currentLectures.length - 1) {
        currentLectureIndex++;
        const lecture = currentLectures[currentLectureIndex];
        playLecture(lecture, currentTeacher);
        showToast('المحاضرة التالية', 'success');
    }
}

// Utility Functions
function showLoading() {
    document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Enhanced Keyboard Navigation - Bunny.net Style
document.addEventListener('keydown', function(e) {
    if (!document.getElementById('player-page').classList.contains('active')) return;
    
    const video = document.getElementById('video-player');
    if (!video) return;
    
    // Prevent default for video-related keys
    const videoKeys = [' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'm', 'M', 'f', 'F', 'p', 'P', 'k', 'K', 'j', 'J', 'l', 'L', 'c', 'C'];
    if (videoKeys.includes(e.key)) {
        e.preventDefault();
    }
    
    switch(e.key) {
        case ' ':
        case 'k':
        case 'K':
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
            break;
        case 'ArrowLeft':
        case 'j':
        case 'J':
            if (e.ctrlKey) {
                playPreviousLecture();
            } else {
                video.currentTime = Math.max(0, video.currentTime - 10);
                document.getElementById('video-toast').textContent = 'تراجع 10 ثواني';
                document.getElementById('video-toast').classList.add('show');
                setTimeout(() => document.getElementById('video-toast').classList.remove('show'), 1500);
            }
            break;
        case 'ArrowRight':
        case 'l':
        case 'L':
            if (e.ctrlKey) {
                playNextLecture();
            } else {
                video.currentTime = Math.min(video.duration, video.currentTime + 10);
                document.getElementById('video-toast').textContent = 'تقديم 10 ثواني';
                document.getElementById('video-toast').classList.add('show');
                setTimeout(() => document.getElementById('video-toast').classList.remove('show'), 1500);
            }
            break;
        case 'ArrowUp':
            video.volume = Math.min(1, video.volume + 0.1);
            video.muted = false;
            document.getElementById('video-toast').textContent = `مستوى الصوت: ${Math.round(video.volume * 100)}%`;
            document.getElementById('video-toast').classList.add('show');
            setTimeout(() => document.getElementById('video-toast').classList.remove('show'), 1500);
            break;
        case 'ArrowDown':
            video.volume = Math.max(0, video.volume - 0.1);
            document.getElementById('video-toast').textContent = `مستوى الصوت: ${Math.round(video.volume * 100)}%`;
            document.getElementById('video-toast').classList.add('show');
            setTimeout(() => document.getElementById('video-toast').classList.remove('show'), 1500);
            break;
        case 'm':
        case 'M':
            video.muted = !video.muted;
            document.getElementById('video-toast').textContent = video.muted ? 'تم كتم الصوت' : 'تم إلغاء الكتم';
            document.getElementById('video-toast').classList.add('show');
            setTimeout(() => document.getElementById('video-toast').classList.remove('show'), 1500);
            break;
        case 'f':
        case 'F':
            if (!document.fullscreenElement) {
                document.querySelector('.video-wrapper').requestFullscreen().catch(console.error);
            } else {
                document.exitFullscreen();
            }
            break;
        case 'p':
        case 'P':
            // Picture-in-Picture
            if (!document.pictureInPictureElement) {
                if (video.requestPictureInPicture) {
                    video.requestPictureInPicture().catch(console.error);
                }
            } else {
                document.exitPictureInPicture();
            }
            break;
        case 'c':
        case 'C':
            // Toggle captions (placeholder for future implementation)
            document.getElementById('video-toast').textContent = 'الترجمة غير متاحة';
            document.getElementById('video-toast').classList.add('show');
            setTimeout(() => document.getElementById('video-toast').classList.remove('show'), 1500);
            break;
        case '1':
            video.playbackRate = 1;
            document.getElementById('speed-btn').querySelector('span').textContent = '1x';
            document.getElementById('video-toast').textContent = 'سرعة عادية';
            document.getElementById('video-toast').classList.add('show');
            setTimeout(() => document.getElementById('video-toast').classList.remove('show'), 1500);
            break;
        case '2':
            video.playbackRate = 2;
            document.getElementById('speed-btn').querySelector('span').textContent = '2x';
            document.getElementById('video-toast').textContent = 'سرعة مضاعفة';
            document.getElementById('video-toast').classList.add('show');
            setTimeout(() => document.getElementById('video-toast').classList.remove('show'), 1500);
            break;
        case 'Escape':
            goBack();
            break;
    }
});

// Search functionality (bonus feature)
function searchLectures(query) {
    const results = [];
    const allData = [teacherData2025, teacherData2026];
    
    allData.forEach((data, yearIndex) => {
        const year = yearIndex === 0 ? '2025' : '2026';
        data.teachers.forEach(teacher => {
            teacher.classes.forEach(cls => {
                cls.lectures.forEach(lecture => {
                    if (lecture.title.includes(query) || 
                        teacher.name.includes(query) || 
                        teacher.subject.includes(query) ||
                        cls.name.includes(query)) {
                        results.push({
                            lecture,
                            teacher,
                            className: cls.name,
                            year
                        });
                    }
                });
            });
        });
    });
    
    return results;
}

// Performance optimization - Lazy loading images
function lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                imageObserver.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
}

// Initialize lazy loading when DOM is ready
document.addEventListener('DOMContentLoaded', lazyLoadImages);

// Service Worker for offline functionality (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registration successful');
            })
            .catch(function(err) {
                console.log('ServiceWorker registration failed');
            });
    });
}

(function () {
	  let detected = false;
	
	  function triggerSecurity() {
		if (detected) return;
		detected = true;
	
		document.documentElement.innerHTML = '';
		alert("🚨 تم اكتشاف محاولة فحص، وتم تسجيل عنوان IP الخاص بك.");
	
		fetch('/api/log-inspect', {
		  method: 'POST',
		  headers: { 'Content-Type': 'application/json' },
		  body: JSON.stringify({
			time: new Date().toISOString(),
			userAgent: navigator.userAgent,
			username: localStorage.getItem('username') || 'غير معروف'
		  })
		});
	
		setTimeout(() => location.href = "/", 1000);
	  }
	
	  // كشف فتح DevTools عبر console.log + Object.defineProperty
	  const el = new Image();
	  Object.defineProperty(el, 'id', {
		get: function () {
		  triggerSecurity();
		}
	  });
	  console.log('%c🚫 لا تحاول العبث بالكود!', 'font-size:100px;', el);
	
	  // كشف DevTools بـ new Function بدل debugger فقط
	  function detectDebuggerDelay() {
		const start = performance.now();
		new Function("debugger")(); // bypass Disable Breakpoints
		const duration = performance.now() - start;
		if (duration > 100) {
		  triggerSecurity();
		}
	  }
	
	  function detectWindowResize() {
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) return;

  const widthDiff = window.outerWidth - window.innerWidth;
  const heightDiff = window.outerHeight - window.innerHeight;

  const maxAllowedDiff = 1000;
  const minSuspiciousDiff = 160;

  if ((widthDiff > minSuspiciousDiff && widthDiff < maxAllowedDiff) ||
      (heightDiff > minSuspiciousDiff && heightDiff < maxAllowedDiff)) {
    triggerSecurity();
  }
}
	
	  // تكرار الفحص كل ثانية
	  setInterval(() => {
		detectDebuggerDelay();
		detectWindowResize();
	  }, 1000);
	
	  // منع جميع الاختصارات الحساسة
	  document.addEventListener("keydown", function (e) {
		const combo = `${e.ctrlKey ? "CTRL+" : ""}${e.shiftKey ? "SHIFT+" : ""}${e.key.toUpperCase()}`;
		const forbidden = [
		  "F12",
		  "CTRL+SHIFT+I",
		  "CTRL+SHIFT+C",
		  "CTRL+SHIFT+J",
		  "CTRL+U",
		  "CTRL+S",
		  "CTRL+A",
		  "CTRL+C",
		  "CTRL+P",
		  "CTRL+E",
		  "CTRL+SHIFT+E",
		  "CTRL+SHIFT+K"
		];
		if (forbidden.includes(combo)) {
		  e.preventDefault();
		  triggerSecurity();
		}
	  });
	
	  // منع الزر الأيمن
	  document.addEventListener("contextmenu", function (e) {
		e.preventDefault();
	  });
	
	  // منع السحب والتحديد
	  document.addEventListener("selectstart", e => e.preventDefault());
	  document.addEventListener("dragstart", e => e.preventDefault());
	
	})();