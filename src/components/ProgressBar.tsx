export interface ProgressBarElement extends HTMLDivElement {
  setProgress: (progress: number) => void;
  setStatus: (status: string) => void;
}

export class ProgressBar {
  private element: ProgressBarElement | null = null;

  private create(): ProgressBarElement {
    const container = document.createElement('div') as ProgressBarElement;
    container.id = 'parsing-progress-container';
    container.setAttribute('aria-live', 'polite');
    container.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      width: 232px;
      z-index: 2147483647;
      pointer-events: none;
    `;

    const shadow = container.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
        }

        .card {
          box-sizing: border-box;
          width: 100%;
          overflow: hidden;
          border: 1px solid rgba(123, 211, 226, 0.26);
          border-radius: 12px;
          background: rgba(12, 27, 34, 0.94);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.24);
          color: #effcff;
          font-family: Inter, "Segoe UI", Arial, sans-serif;
          backdrop-filter: blur(12px);
          animation: enter 160ms ease-out;
        }

        .content {
          display: grid;
          grid-template-columns: 30px minmax(0, 1fr) auto;
          align-items: center;
          gap: 9px;
          padding: 10px 11px 9px;
        }

        .icon {
          display: grid;
          width: 28px;
          height: 28px;
          place-items: center;
          border: 1px solid rgba(85, 226, 211, 0.28);
          border-radius: 9px;
          background: linear-gradient(145deg, rgba(38, 166, 174, 0.26), rgba(31, 90, 116, 0.2));
        }

        .spinner {
          box-sizing: border-box;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(154, 239, 239, 0.24);
          border-top-color: #65e4d5;
          border-radius: 50%;
          animation: spin 800ms linear infinite;
        }

        .copy {
          min-width: 0;
        }

        .title {
          overflow: hidden;
          color: #ecfdff;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.03em;
          line-height: 1.2;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .status {
          overflow: hidden;
          margin-top: 2px;
          color: #9fc4cd;
          font-size: 9px;
          line-height: 1.2;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .percent {
          color: #92eee1;
          font-size: 10px;
          font-variant-numeric: tabular-nums;
          font-weight: 700;
        }

        .track {
          height: 2px;
          background: rgba(137, 200, 211, 0.14);
        }

        .fill {
          width: 0%;
          height: 100%;
          border-radius: 0 2px 2px 0;
          background: linear-gradient(90deg, #32c5bf, #83edcf);
          box-shadow: 0 0 8px rgba(76, 221, 206, 0.5);
          transition: width 220ms ease;
        }

        .card.done .spinner {
          border: 0;
          animation: none;
        }

        .card.done .spinner::after {
          color: #73e3b2;
          content: "✓";
          font-size: 14px;
          font-weight: 800;
        }

        .card.error {
          border-color: rgba(255, 121, 137, 0.4);
        }

        .card.error .spinner {
          border: 0;
          animation: none;
        }

        .card.error .spinner::after {
          color: #ff8996;
          content: "!";
          font-size: 14px;
          font-weight: 800;
        }

        .card.error .fill {
          background: #ff7e90;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes enter {
          from { opacity: 0; transform: translateY(-5px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @media (max-width: 480px) {
          .card {
            width: 200px;
          }
        }
      </style>
      <div class="card">
        <div class="content">
          <div class="icon"><div class="spinner"></div></div>
          <div class="copy">
            <div class="title">DeepTrace scanning</div>
            <div class="status">Checking page endpoints</div>
          </div>
          <div class="percent">0%</div>
        </div>
        <div class="track"><div class="fill"></div></div>
      </div>
    `;

    const card = shadow.querySelector<HTMLElement>('.card')!;
    const progressFill = shadow.querySelector<HTMLElement>('.fill')!;
    const percentText = shadow.querySelector<HTMLElement>('.percent')!;
    const statusText = shadow.querySelector<HTMLElement>('.status')!;

    container.setProgress = (progress: number) => {
      const normalizedProgress = Math.min(100, Math.max(0, Math.round(progress)));
      progressFill.style.width = `${normalizedProgress}%`;
      percentText.textContent = `${normalizedProgress}%`;
      card.classList.toggle('done', normalizedProgress === 100 && !card.classList.contains('error'));
    };

    container.setStatus = (status: string) => {
      const hasError = status.toLowerCase().includes('error');
      card.classList.toggle('error', hasError);
      statusText.textContent = status.replace(/\.\.\./g, '').trim() || 'Checking page endpoints';
    };

    document.documentElement.appendChild(container);
    return container;
  }

  update(progress: number, status: string): void {
    if (!this.element || !this.element.isConnected) {
      this.element = this.create();
    }

    this.element.setStatus(status);
    this.element.setProgress(progress);
  }

  remove(): void {
    this.element?.remove();
    this.element = null;
  }
}
