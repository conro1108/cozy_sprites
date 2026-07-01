import './style.css';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="stage">your pet goes here</div>
  <nav class="nav">
    <button type="button">Home</button>
    <button type="button">Feed</button>
    <button type="button">Play</button>
  </nav>
`;
