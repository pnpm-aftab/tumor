const revealTargets = document.querySelectorAll(
  "[data-reveal]"
);

const observer = new IntersectionObserver(
  entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.1 }
);

for (const target of revealTargets) {
  observer.observe(target);
}

// App Mockup Interactivity
const mockupInput = document.getElementById('mockup-input');
const mockupSubmit = document.getElementById('mockup-submit');
const mockupPanel = document.getElementById('mockup-panel');
const mockupClose = document.getElementById('mockup-close');

if (mockupInput && mockupSubmit && mockupPanel && mockupClose) {
  const submitQuestion = () => {
    if (!mockupInput.value.trim() && !mockupInput.placeholder) return;
    
    // Loading state
    mockupSubmit.classList.add('is-loading');
    
    // Simulate network delay
    setTimeout(() => {
      mockupSubmit.classList.remove('is-loading');
      mockupPanel.classList.add('is-open');
    }, 800);
  };

  mockupSubmit.addEventListener('click', submitQuestion);
  
  mockupInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      submitQuestion();
    }
  });

  mockupClose.addEventListener('click', () => {
    mockupPanel.classList.remove('is-open');
    mockupInput.value = '';
    mockupInput.focus();
  });
}
