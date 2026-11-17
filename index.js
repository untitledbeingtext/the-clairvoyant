(async function initPixelTarot() {
  const GRID_SIZE = 8;
  const LABEL_ROWS = 5;
  const LABEL_COLS = 30;

  const CARD_COLS = 30;
  const CARD_ROWS = 30;
  const SLOT_OFFSET_X = 3;
  const SLOT_OFFSET_TOP = 3;
  const SLOT_OFFSET_BOTTOM = 3;

  const SLOT_COLS = CARD_COLS + SLOT_OFFSET_X * 2;
  const SLOT_ROWS = SLOT_OFFSET_TOP + CARD_ROWS + LABEL_ROWS + SLOT_OFFSET_BOTTOM;
  const TOTAL_SLOTS = 5;

  const COL_GAP = 1;
  const ROW_GAP = 1;
  const TITLE_MARGIN_GRID = 5;

  document.documentElement.style.overscrollBehavior = "none";
  document.body.style.overscrollBehavior = "none";

  let paletteList = [
    {
      primary: "#4e4035",
      secondary: "#8B9E44",
      Y: "#ffe321",
      G: "#99af68",
      R: "#ff332f",
      C: "#f1ede2"
    }
  ];
  let cardsList = [];
  let back2Data = null;
  let titleData = null;
  let titleVerticalData = null;

  //fade away
  const hoveredGridCells = new Map();
  const TRAIL_FADE_DURATION = 100;

  function snapToGrid(value) {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  }

  function getViewportSize() {
    const width = document.documentElement.clientWidth || window.innerWidth;
    const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    return { width, height };
  }

  // overscroll + grid step snapping
  function getClampedScroll() {
    const { width, height } = getViewportSize();
    const docWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, width);
    const docHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, height);

    const maxScrollX = Math.max(0, docWidth - width);
    const maxScrollY = Math.max(0, docHeight - height);

    const rawScrollX = Math.max(0, Math.min(window.scrollX, maxScrollX));
    const rawScrollY = Math.max(0, Math.min(window.scrollY, maxScrollY));

    const scrollX = Math.min(snapToGrid(rawScrollX), maxScrollX);
    const scrollY = Math.min(snapToGrid(rawScrollY), maxScrollY);

    return { scrollX, scrollY };
  }

  // Grid snapping khi dừng scroll
  let scrollSnapTimer = null;
  let isSnappingScroll = false;

  function snapWindowScrollToGrid() {
    const { width, height } = getViewportSize();
    const docWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, width);
    const docHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, height);

    const maxScrollX = Math.max(0, docWidth - width);
    const maxScrollY = Math.max(0, docHeight - height);

    const currentX = window.scrollX;
    const currentY = window.scrollY;

    const snappedX = Math.max(0, Math.min(snapToGrid(currentX), maxScrollX));
    const snappedY = Math.max(0, Math.min(snapToGrid(currentY), maxScrollY));

    if (Math.abs(currentX - snappedX) >= 1 || Math.abs(currentY - snappedY) >= 1) {
      isSnappingScroll = true;
      window.scrollTo({
        left: snappedX,
        top: snappedY,
        behavior: "smooth"
      });
      setTimeout(() => {
        isSnappingScroll = false;
      }, 150);
    }
  }

  window.addEventListener("scroll", () => {
    if (isSnappingScroll) return;
    clearTimeout(scrollSnapTimer);
    scrollSnapTimer = setTimeout(snapWindowScrollToGrid, 90);
  }, { passive: true });

  // import index.json
  try {
    const indexResponse = await fetch("./data/index.json");

    if (indexResponse.ok) {
      const indexData = await indexResponse.json();
      if (indexData.palette && indexData.palette.length > 0) {
        paletteList = indexData.palette;
      }

      const itemsConfig = indexData.items || {};
      const fetchItem = async (relPath) => {
        if (!relPath) return null;
        try {
          const res = await fetch(`./data/${relPath}`);
          return res.ok ? await res.json() : null;
        } catch {
          return null;
        }
      };

      const [loadedBack2, loadedTitle, loadedTitleVer] = await Promise.all([
        fetchItem(itemsConfig.back_2),
        fetchItem(itemsConfig.title),
        fetchItem(itemsConfig.title_ver)
      ]);

      back2Data = loadedBack2;
      titleData = loadedTitle;
      titleVerticalData = loadedTitleVer;

      const cardsConfig = indexData.cards || {};
      const majorFiles = cardsConfig.major_arcana || [];
      const minorConfig = cardsConfig.minor_arcana || {};

      const allCardPaths = [
        ...majorFiles,
        ...(minorConfig.wands || []),
        ...(minorConfig.pentacles || []),
        ...(minorConfig.cups || []),
        ...(minorConfig.swords || [])
      ];

      const cardPromises = allCardPaths.map(async (relativePath) => {
        const res = await fetch(`./data/${relativePath}`);
        if (!res.ok) {
          console.warn(`Không tìm thấy file lá bài: ./data/${relativePath}`);
          return null;
        }
        return res.json();
      });

      const loadedCards = await Promise.all(cardPromises);
      cardsList = loadedCards.filter((card) => card !== null);
    }
  } catch (err) {
    console.warn("Liveserver error", err);
  }

  //shuffle card
  let shuffledDeck = [];
  let lastDrawnCardIndex = -1;

  function shuffleAndRefillDeck() {
    if (cardsList.length === 0) return;

    const indices = cardsList.map((_, idx) => idx);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    if (indices.length > 1 && indices[indices.length - 1] === lastDrawnCardIndex) {
      [indices[0], indices[indices.length - 1]] = [indices[indices.length - 1], indices[0]];
    }

    shuffledDeck = indices;
  }

  function drawNextCardIndex() {
    if (cardsList.length === 0) return -1;
    if (shuffledDeck.length === 0) {
      shuffleAndRefillDeck();
    }
    const nextIdx = shuffledDeck.pop();
    lastDrawnCardIndex = nextIdx;
    return nextIdx;
  }

  //console drag & center-bottom positioning
  const guideConsole = document.getElementById("guideConsole");
  const consoleToggleBtn = document.getElementById("consoleToggleBtn");
  const consoleCloseBtn = document.getElementById("consoleCloseBtn");
  const consoleAppBtn = document.getElementById("consoleAppBtn");
  const consoleHeader = guideConsole ? guideConsole.querySelector(".console-header") : null;

  let hasUserDraggedConsole = false;

  function centerConsoleBottom() {
    const { width, height } = getViewportSize();

    if (guideConsole && guideConsole.style.display !== "none" && !hasUserDraggedConsole) {
      guideConsole.style.maxWidth = `${Math.max(240, width - GRID_SIZE * 2)}px`;
      guideConsole.style.position = "fixed";
      guideConsole.style.right = "auto";
      guideConsole.style.bottom = "auto";

      const boxWidth = guideConsole.offsetWidth;
      const boxHeight = guideConsole.offsetHeight;

      const targetLeft = snapToGrid(Math.max(GRID_SIZE, (width - boxWidth) / 2));
      const targetTop = snapToGrid(Math.max(GRID_SIZE, height - boxHeight - GRID_SIZE * 2));

      guideConsole.style.left = `${targetLeft}px`;
      guideConsole.style.top = `${targetTop}px`;
    } else if (guideConsole && guideConsole.style.display !== "none" && hasUserDraggedConsole) {
      const maxLeft = Math.max(0, Math.floor((width - guideConsole.offsetWidth) / GRID_SIZE) * GRID_SIZE);
      const maxTop = Math.max(0, Math.floor((height - guideConsole.offsetHeight) / GRID_SIZE) * GRID_SIZE);
      const curLeft = parseInt(guideConsole.style.left, 10) || 0;
      const curTop = parseInt(guideConsole.style.top, 10) || 0;
      guideConsole.style.left = `${Math.max(0, Math.min(curLeft, maxLeft))}px`;
      guideConsole.style.top = `${Math.max(0, Math.min(curTop, maxTop))}px`;
    }

    if (consoleAppBtn && consoleAppBtn.style.display !== "none") {
      consoleAppBtn.style.position = "fixed";
      consoleAppBtn.style.right = "auto";
      consoleAppBtn.style.bottom = "auto";

      const btnWidth = consoleAppBtn.offsetWidth || 40;
      const btnHeight = consoleAppBtn.offsetHeight || 40;
      const targetLeft = snapToGrid(Math.max(GRID_SIZE, (width - btnWidth) / 2));
      const targetTop = snapToGrid(Math.max(GRID_SIZE, height - btnHeight - GRID_SIZE * 2));

      consoleAppBtn.style.left = `${targetLeft}px`;
      consoleAppBtn.style.top = `${targetTop}px`;
    }
  }

  function makeDraggable(targetEl, handleEl, onDragEndCallback) {
    let isDragging = false;
    let hasMoved = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    function onStart(clientX, clientY) {
      isDragging = true;
      hasMoved = false;
      const rect = targetEl.getBoundingClientRect();
      initialLeft = snapToGrid(rect.left);
      initialTop = snapToGrid(rect.top);
      startX = clientX;
      startY = clientY;

      targetEl.style.left = `${initialLeft}px`;
      targetEl.style.top = `${initialTop}px`;
      targetEl.style.right = "auto";
      targetEl.style.bottom = "auto";
    }

    function onMove(clientX, clientY) {
      if (!isDragging) return;
      const dx = clientX - startX;
      const dy = clientY - startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMoved = true;
      }

      const { width, height } = getViewportSize();
      const snappedLeft = snapToGrid(initialLeft + dx);
      const snappedTop = snapToGrid(initialTop + dy);

      const maxLeft = Math.max(0, Math.floor((width - targetEl.offsetWidth) / GRID_SIZE) * GRID_SIZE);
      const maxTop = Math.max(0, Math.floor((height - targetEl.offsetHeight) / GRID_SIZE) * GRID_SIZE);

      targetEl.style.left = `${Math.max(0, Math.min(snappedLeft, maxLeft))}px`;
      targetEl.style.top = `${Math.max(0, Math.min(snappedTop, maxTop))}px`;
    }

    function onEnd() {
      if (!isDragging) return;
      isDragging = false;
      if (onDragEndCallback) onDragEndCallback(hasMoved);
    }

    handleEl.addEventListener("mousedown", (e) => {
      if (e.target.closest("button") && handleEl !== targetEl) return;
      onStart(e.clientX, e.clientY);
    });

    window.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
    window.addEventListener("mouseup", onEnd);

    handleEl.addEventListener("touchstart", (e) => {
      if (e.target.closest("button") && handleEl !== targetEl) return;
      if (e.touches.length > 0) onStart(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    window.addEventListener("touchmove", (e) => {
      if (isDragging && e.touches.length > 0) onMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    window.addEventListener("touchend", onEnd);

    return () => hasMoved;
  }

  if (guideConsole && consoleToggleBtn && consoleCloseBtn && consoleAppBtn && consoleHeader) {
    let consoleWasDragged = false;
    let appBtnWasDragged = false;

    makeDraggable(guideConsole, consoleHeader, (moved) => {
      consoleWasDragged = moved;
      if (moved) hasUserDraggedConsole = true;
    });
    makeDraggable(consoleAppBtn, consoleAppBtn, (moved) => {
      appBtnWasDragged = moved;
    });

    const toggleMinimize = () => {
      const isMinimized = guideConsole.classList.toggle("minimized");
      consoleToggleBtn.textContent = isMinimized ? "+" : "-";
      consoleToggleBtn.title = isMinimized ? "Mở rộng" : "Thu lại";
      centerConsoleBottom();
    };

    consoleToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMinimize();
    });

    consoleHeader.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      if (consoleWasDragged) {
        consoleWasDragged = false;
        return;
      }
      toggleMinimize();
    });

    consoleCloseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      guideConsole.style.display = "none";
      consoleAppBtn.style.display = "flex";
      centerConsoleBottom();
    });

    consoleAppBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (appBtnWasDragged) {
        appBtnWasDragged = false;
        return;
      }
      consoleAppBtn.style.display = "none";
      guideConsole.style.display = "block";
      hasUserDraggedConsole = false;
      centerConsoleBottom();
    });

    centerConsoleBottom();
  }

  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "0";
  document.body.prepend(canvas);

  const ctx = canvas.getContext("2d");

  const placedCards = [];
  let paletteIndex = 0;

  let nextCardIndex = drawNextCardIndex();
  let hoverGridPos = null;
  let isHoveringUI = false;

  let webTitleBounds = null;
  const noteEl = document.querySelector(".note");

  function updateNoteBounds() {
    if (!noteEl) return;
    const { scrollX, scrollY } = getClampedScroll();
    const rect = noteEl.getBoundingClientRect();
    webTitleBounds = {
      minCol: Math.floor((rect.left + scrollX) / GRID_SIZE) + 2,
      maxCol: Math.ceil((rect.right + scrollX) / GRID_SIZE) - 2,
      minRow: Math.floor((rect.top + scrollY) / GRID_SIZE) + 2,
      maxRow: Math.ceil((rect.bottom + scrollY) / GRID_SIZE) - 2
    };
  }

  if (noteEl && "ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(() => updateNoteBounds());
    resizeObserver.observe(noteEl);
  }

  function isCellInNoteZone(col, row) {
    if (window.innerWidth <= 600) return false;
    if (!webTitleBounds) return false;
    return (
      col >= webTitleBounds.minCol &&
      col <= webTitleBounds.maxCol &&
      row >= webTitleBounds.minRow &&
      row <= webTitleBounds.maxRow
    );
  }

  function getItemMetrics(itemData) {
    if (!itemData || !itemData.pattern) return null;

    const pattern = itemData.pattern;
    const totalRows = pattern.length;
    const totalCols = (pattern[0] && pattern[0].length) || 30;

    let minActiveCol = totalCols;
    let maxActiveCol = -1;
    let minActiveRow = totalRows;
    let maxActiveRow = -1;

    for (let r = 0; r < totalRows; r++) {
      const rowStr = pattern[r] || "";
      for (let c = 0; c < rowStr.length; c++) {
        if (rowStr[c] !== ".") {
          if (c < minActiveCol) minActiveCol = c;
          if (c > maxActiveCol) maxActiveCol = c;
          if (r < minActiveRow) minActiveRow = r;
          if (r > maxActiveRow) maxActiveRow = r;
        }
      }
    }

    if (maxActiveCol < minActiveCol) return null;

    return {
      pattern,
      totalRows,
      minActiveCol,
      maxActiveCol,
      minActiveRow,
      maxActiveRow,
      activeWidthCols: maxActiveCol - minActiveCol + 1,
      activeHeightRows: maxActiveRow - minActiveRow + 1,
      centerCol: Math.floor((minActiveCol + maxActiveCol) / 2),
      centerRow: Math.floor((minActiveRow + maxActiveRow) / 2)
    };
  }

  function getActiveTitleMetrics(viewWidth) {
    const isMobile = viewWidth <= 600;
    const activeTitleData = isMobile && titleVerticalData ? titleVerticalData : titleData;
    return getItemMetrics(activeTitleData);
  }

  // shrink measurement
  function getCenteredSlotsLayout() {
    const { width, height } = getViewportSize();
    const viewCols = Math.floor(width / GRID_SIZE);
    const viewRows = Math.floor(height / GRID_SIZE);

    const widthForCount = (n) => n * SLOT_COLS + (n - 1) * COL_GAP;

    let rowDistribution;
    if (viewCols >= widthForCount(5)) {
      rowDistribution = [5];
    } else if (viewCols >= widthForCount(3)) {
      rowDistribution = [3, 2];
    } else if (viewCols >= widthForCount(2)) {
      rowDistribution = [2, 2, 1];
    } else {
      rowDistribution = [1, 1, 1, 1, 1];
    }

    const numRows = rowDistribution.length;
    const totalGridRows = numRows * SLOT_ROWS + (numRows - 1) * ROW_GAP;

    const titleMetrics = getActiveTitleMetrics(width);
    const titleHeightRows = titleMetrics ? titleMetrics.activeHeightRows : 0;
    const minTopMargin = titleHeightRows > 0
      ? TITLE_MARGIN_GRID + titleHeightRows + TITLE_MARGIN_GRID
      : 0;

    const startRow = Math.max(minTopMargin, Math.floor((viewRows - totalGridRows) / 2));

    const slots = [];
    let currentSlotIndex = 0;

    for (let r = 0; r < numRows; r++) {
      const countInRow = rowDistribution[r];
      const rowTotalCols = widthForCount(countInRow);
      const rowStartCol = Math.max(0, Math.floor((viewCols - rowTotalCols) / 2));
      const rowStartRow = startRow + r * (SLOT_ROWS + ROW_GAP);

      for (let c = 0; c < countInRow; c++) {
        const minCol = rowStartCol + c * (SLOT_COLS + COL_GAP);
        const minRow = rowStartRow;

        slots.push({
          slotIndex: currentSlotIndex,
          minCol,
          maxCol: minCol + SLOT_COLS - 1,
          minRow,
          maxRow: minRow + SLOT_ROWS - 1
        });
        currentSlotIndex++;
      }
    }

    return {
      slots,
      startRow,
      endRow: startRow + totalGridRows - 1
    };
  }

  function getSlotByIndex(slotIndex) {
    const layout = getCenteredSlotsLayout();
    return layout.slots[slotIndex] || null;
  }

  function getSlotInfo(col, row) {
    const layout = getCenteredSlotsLayout();
    for (const slot of layout.slots) {
      if (
        col >= slot.minCol &&
        col <= slot.maxCol &&
        row >= slot.minRow &&
        row <= slot.maxRow
      ) {
        return slot;
      }
    }
    return null;
  }

  function getCenteredCardAnchorInSlot(slot, card) {
    const pattern = card.pattern || [];
    const totalRows = pattern.length || CARD_ROWS;
    const totalCols = (pattern[0] && pattern[0].length) || CARD_COLS;
    const anchorCol = card.anchorCol ?? Math.floor(totalCols / 2);

    const horizontalMargin = Math.floor((SLOT_COLS - totalCols) / 2);
    const baseCol = slot.minCol + horizontalMargin + anchorCol;
    const baseRow = slot.minRow + SLOT_OFFSET_TOP + (totalRows - 1);

    return { baseCol, baseRow };
  }

  function getCardBounds(baseCol, baseRow, card) {
    const pattern = card.pattern || [];
    const totalRows = pattern.length || CARD_ROWS;
    const totalCols = (pattern[0] && pattern[0].length) || CARD_COLS;
    const anchorCol = card.anchorCol ?? Math.floor(totalCols / 2);

    const minCol = baseCol - anchorCol;
    const maxCol = minCol + totalCols - 1;
    const maxRow = baseRow + LABEL_ROWS;
    const minRow = baseRow - (totalRows - 1);

    return { minCol, maxCol, minRow, maxRow, totalCols, totalRows, anchorCol };
  }

  function syncPlacedCardsToSlots() {
    for (const card of placedCards) {
      const slot = getSlotByIndex(card.slotIndex);
      if (!slot) continue;

      const { baseCol, baseRow } = getCenteredCardAnchorInSlot(slot, card.data);
      const bounds = getCardBounds(baseCol, baseRow, card.data);

      card.baseCol = baseCol;
      card.baseRow = baseRow;
      card.anchorCol = bounds.anchorCol;
      card.bounds = bounds;
    }
  }

  function updateDocumentScrollHeight() {
    const layout = getCenteredSlotsLayout();
    const { height } = getViewportSize();
    const requiredHeightPx = (layout.endRow + 12) * GRID_SIZE;

    if (requiredHeightPx > height) {
      document.documentElement.style.height = `${requiredHeightPx}px`;
      document.body.style.height = `${requiredHeightPx}px`;
      document.body.style.minHeight = `${requiredHeightPx}px`;
    } else {
      document.documentElement.style.height = "100%";
      document.body.style.height = "100%";
      document.body.style.minHeight = "";
    }
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = getViewportSize();

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    updateNoteBounds();
    updateDocumentScrollHeight();
    syncPlacedCardsToSlots();
    centerConsoleBottom();
  }

  window.addEventListener("resize", resizeCanvas);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", resizeCanvas);
  }
  resizeCanvas();

  function getGridCoords(clientX, clientY) {
    const { scrollX, scrollY } = getClampedScroll();
    const pageX = clientX + scrollX;
    const pageY = clientY + scrollY;
    return {
      col: Math.floor(pageX / GRID_SIZE),
      row: Math.floor(pageY / GRID_SIZE)
    };
  }

  function isSlotOccupied(slotIndex) {
    return placedCards.some((c) => c.slotIndex === slotIndex);
  }

  function checkBoundsOverlap(bounds) {
    for (const existing of placedCards) {
      const ex = existing.bounds;
      const isOverlapping =
        bounds.minCol <= ex.maxCol &&
        bounds.maxCol >= ex.minCol &&
        bounds.minRow <= ex.maxRow &&
        bounds.maxRow >= ex.minRow;

      if (isOverlapping) return true;
    }

    if (window.innerWidth > 600 && webTitleBounds) {
      const overlapsNote =
        bounds.minCol <= webTitleBounds.maxCol &&
        bounds.maxCol >= webTitleBounds.minCol &&
        bounds.minRow <= webTitleBounds.maxRow &&
        bounds.maxRow >= webTitleBounds.minRow;

      if (overlapsNote) return true;
    }

    return false;
  }

  function isUIElement(targetEl) {
    return (
      targetEl &&
      (targetEl.closest(".console-box") ||
        targetEl.closest(".console-app-btn") ||
        targetEl.closest(".note"))
    );
  }

  function handleInteraction(clientX, clientY, targetEl) {
    isHoveringUI = Boolean(isUIElement(targetEl));
    const { col, row } = getGridCoords(clientX, clientY);
    hoverGridPos = { col, row };

    if (!isHoveringUI && !isCellInNoteZone(col, row)) {
      hoveredGridCells.set(`${col},${row}`, {
        col,
        row,
        time: performance.now()
      });
    }
  }

  window.addEventListener("mousemove", (e) => {
    handleInteraction(e.clientX, e.clientY, e.target);
  });

  window.addEventListener("mouseleave", () => {
    hoverGridPos = null;
  });

  window.addEventListener("touchmove", (e) => {
    if (e.touches.length > 0) {
      handleInteraction(e.touches[0].clientX, e.touches[0].clientY, e.target);
    }
  }, { passive: true });

  function handlePlaceCard(clientX, clientY, targetEl) {
    if (!cardsList || cardsList.length === 0 || nextCardIndex < 0) return;
    if (isUIElement(targetEl)) return;

    const { col, row } = getGridCoords(clientX, clientY);
    if (isCellInNoteZone(col, row)) return;

    const slot = getSlotInfo(col, row);
    if (!slot) return;

    if (isSlotOccupied(slot.slotIndex)) {
      return;
    }

    const selectedCard = cardsList[nextCardIndex];
    const { baseCol, baseRow } = getCenteredCardAnchorInSlot(slot, selectedCard);
    const bounds = getCardBounds(baseCol, baseRow, selectedCard);

    if (checkBoundsOverlap(bounds)) {
      return;
    }

    const selectedPalette = paletteList[paletteIndex % paletteList.length];
    paletteIndex++;

    placedCards.push({
      slotIndex: slot.slotIndex,
      data: selectedCard,
      name: selectedCard.name || "",
      baseCol: baseCol,
      baseRow: baseRow,
      anchorCol: bounds.anchorCol,
      bounds: bounds,
      pattern: selectedCard.pattern || [],
      primaryColor: selectedPalette.primary || "#4e4035",
      secondaryColor: selectedPalette.secondary || "#8B9E44",
      palette: selectedPalette,
      currentRowOffset: 0,
      lastGrowTime: performance.now(),
      growSpeed: 75
    });

    nextCardIndex = drawNextCardIndex();
  }

  let lastTouchTime = 0;

  window.addEventListener("click", (e) => {
    if (Date.now() - lastTouchTime < 500) return;
    handlePlaceCard(e.clientX, e.clientY, e.target);
  });

  window.addEventListener("touchstart", (e) => {
    lastTouchTime = Date.now();
    if (e.touches.length > 0) {
      handleInteraction(e.touches[0].clientX, e.touches[0].clientY, e.target);
      handlePlaceCard(e.touches[0].clientX, e.touches[0].clientY, e.target);
    }
  }, { passive: true });

  function drawGridHoverTrail(now, viewWidth, viewHeight, scrollX, scrollY) {
    if (hoveredGridCells.size === 0) return;

    const brownColor = paletteList[0]?.primary || "#4e4035";
    ctx.save();
    ctx.fillStyle = brownColor;

    for (const [key, cell] of hoveredGridCells.entries()) {
      const isCurrentlyUnderCursor =
        hoverGridPos &&
        !isHoveringUI &&
        hoverGridPos.col === cell.col &&
        hoverGridPos.row === cell.row;

      if (isCurrentlyUnderCursor) {
        cell.time = now;
      }

      const elapsed = now - cell.time;
      if (elapsed >= TRAIL_FADE_DURATION) {
        hoveredGridCells.delete(key);
        continue;
      }

      const alpha = Math.max(0, 1 - elapsed / TRAIL_FADE_DURATION);
      const screenX = cell.col * GRID_SIZE - scrollX;
      const screenY = cell.row * GRID_SIZE - scrollY;

      if (
        screenX + GRID_SIZE >= 0 &&
        screenX <= viewWidth &&
        screenY + GRID_SIZE >= 0 &&
        screenY <= viewHeight
      ) {
        ctx.globalAlpha = alpha;
        ctx.fillRect(screenX + 1, screenY + 1, GRID_SIZE - 1, GRID_SIZE - 1);
      }
    }

    ctx.restore();
  }

  // placeholder
  function drawSlotGrid(scrollX, scrollY) {
    const layout = getCenteredSlotsLayout();

    ctx.save();
    ctx.strokeStyle = "rgba(78, 64, 53, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (const slot of layout.slots) {
      const x = slot.minCol * GRID_SIZE - scrollX;
      const y = slot.minRow * GRID_SIZE - scrollY;
      const w = SLOT_COLS * GRID_SIZE;
      const h = SLOT_ROWS * GRID_SIZE;

      ctx.rect(x, y, w, h);
    }

    ctx.stroke();
    ctx.restore();
  }

  function drawIntroTitle(viewWidth, viewHeight, scrollX, scrollY) {
    const metrics = getActiveTitleMetrics(viewWidth);
    if (!metrics) return;

    const layout = getCenteredSlotsLayout();
    const viewCols = Math.floor(viewWidth / GRID_SIZE);

    const targetCenterCol = Math.floor(viewCols / 2);
    const targetTopRow = Math.max(
      TITLE_MARGIN_GRID,
      layout.startRow - TITLE_MARGIN_GRID - metrics.activeHeightRows
    );

    const primaryColor = paletteList[0]?.primary || "#4e4035";
    const secondaryColor = paletteList[0]?.secondary || "#8B9E44";

    ctx.save();

    for (let r = metrics.minActiveRow; r <= metrics.maxActiveRow; r++) {
      const rowStr = metrics.pattern[r];
      if (!rowStr) continue;
      const gridRow = targetTopRow + (r - metrics.minActiveRow);

      for (let c = metrics.minActiveCol; c <= metrics.maxActiveCol; c++) {
        const ch = rowStr[c];
        if (!ch || ch === ".") continue;

        const gridCol = targetCenterCol + (c - metrics.centerCol);
        const screenX = gridCol * GRID_SIZE - scrollX;
        const screenY = gridRow * GRID_SIZE - scrollY;

        if (
          screenX + GRID_SIZE >= 0 &&
          screenX <= viewWidth &&
          screenY + GRID_SIZE >= 0 &&
          screenY <= viewHeight
        ) {
          ctx.fillStyle = ch === "P" ? primaryColor : secondaryColor;
          ctx.fillRect(screenX + 1, screenY + 1, GRID_SIZE - 1, GRID_SIZE - 1);
        }
      }
    }

    ctx.restore();
  }

  function drawBack2Neon(centerCol, centerRow, viewWidth, viewHeight, scrollX, scrollY) {
    const metrics = getItemMetrics(back2Data);
    if (!metrics) return;

    ctx.save();
    ctx.fillStyle = "#e7f70f";
    ctx.shadowColor = "#e7f70f";
    ctx.shadowBlur = 10;

    for (let r = metrics.minActiveRow; r <= metrics.maxActiveRow; r++) {
      const rowStr = metrics.pattern[r];
      if (!rowStr) continue;
      const targetGridRow = centerRow + (r - metrics.centerRow);

      for (let c = metrics.minActiveCol; c <= metrics.maxActiveCol; c++) {
        if (!rowStr[c] || rowStr[c] === ".") continue;
        const targetGridCol = centerCol + (c - metrics.centerCol);

        const screenX = targetGridCol * GRID_SIZE - scrollX;
        const screenY = targetGridRow * GRID_SIZE - scrollY;

        if (
          screenX + GRID_SIZE >= 0 &&
          screenX <= viewWidth &&
          screenY + GRID_SIZE >= 0 &&
          screenY <= viewHeight
        ) {
          ctx.fillRect(screenX + 1, screenY + 1, GRID_SIZE - 1, GRID_SIZE - 1);
        }
      }
    }

    ctx.restore();
  }

  function render(now) {
    const { width: viewWidth, height: viewHeight } = getViewportSize();
    ctx.clearRect(0, 0, viewWidth, viewHeight);

    const { scrollX, scrollY } = getClampedScroll();
    document.body.style.backgroundPosition = `${-scrollX}px ${-scrollY}px`;

    drawGridHoverTrail(now, viewWidth, viewHeight, scrollX, scrollY);

    drawSlotGrid(scrollX, scrollY);
    drawIntroTitle(viewWidth, viewHeight, scrollX, scrollY);

    for (const card of placedCards) {
      const pattern = card.pattern;
      const totalRows = pattern.length;
      const centerOffset = card.anchorCol;

      if (card.currentRowOffset < totalRows - 1) {
        if (now - card.lastGrowTime >= card.growSpeed) {
          card.currentRowOffset++;
          card.lastGrowTime = now;
        }
      }

      for (let step = 0; step <= card.currentRowOffset; step++) {
        const patternRowIndex = totalRows - 1 - step;
        const rowStr = pattern[patternRowIndex];
        if (!rowStr) continue;

        const targetGridRow = card.baseRow - step;

        for (let c = 0; c < rowStr.length; c++) {
          const pixelType = rowStr[c];
          if (pixelType === ".") continue;

          const targetGridCol = card.baseCol + (c - centerOffset);
          if (isCellInNoteZone(targetGridCol, targetGridRow)) continue;

          const screenX = targetGridCol * GRID_SIZE - scrollX;
          const screenY = targetGridRow * GRID_SIZE - scrollY;

          if (
            screenX + GRID_SIZE < 0 ||
            screenX > viewWidth ||
            screenY + GRID_SIZE < 0 ||
            screenY > viewHeight
          ) {
            continue;
          }

          if (pixelType === "P") {
            ctx.fillStyle = card.primaryColor;
          } else if (card.palette && card.palette[pixelType]) {
            ctx.fillStyle = card.palette[pixelType];
          } else {
            ctx.fillStyle = card.secondaryColor;
          }

          ctx.fillRect(screenX + 1, screenY + 1, GRID_SIZE - 1, GRID_SIZE - 1);
        }
      }

      if (card.name && card.currentRowOffset >= totalRows - 1) {
        const cardCenterX = (card.bounds.minCol + card.bounds.maxCol + 1) * GRID_SIZE * 0.5 - scrollX;
        const labelBottomY = (card.baseRow + 1 + LABEL_ROWS + SLOT_OFFSET_BOTTOM - 2) * GRID_SIZE - scrollY;
        const maxLabelWidth = LABEL_COLS * GRID_SIZE;

        if (
          cardCenterX + maxLabelWidth / 2 >= 0 &&
          cardCenterX - maxLabelWidth / 2 <= viewWidth &&
          labelBottomY + 20 >= 0 &&
          labelBottomY - 20 <= viewHeight
        ) {
          ctx.save();
          ctx.font = "26px 'MedievalSharp', cursive";
          ctx.fillStyle = card.primaryColor;
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(card.name, cardCenterX, labelBottomY, maxLabelWidth);
          ctx.restore();
        }
      }
    }

    if (hoverGridPos && !isHoveringUI) {
      const slot = getSlotInfo(hoverGridPos.col, hoverGridPos.row);

      if (slot) {
        document.body.style.cursor = "pointer";

        if (isSlotOccupied(slot.slotIndex)) {
          drawBack2Neon(
            hoverGridPos.col,
            hoverGridPos.row,
            viewWidth,
            viewHeight,
            scrollX,
            scrollY
          );
        } else if (cardsList.length > 0 && nextCardIndex >= 0) {
          const previewCard = cardsList[nextCardIndex];
          const centeredAnchor = getCenteredCardAnchorInSlot(slot, previewCard);
          const previewBounds = getCardBounds(
            centeredAnchor.baseCol,
            centeredAnchor.baseRow,
            previewCard
          );

          if (!checkBoundsOverlap(previewBounds)) {
            const selectedPalette = paletteList[paletteIndex % paletteList.length];
            const cardColor = selectedPalette.primary || "#4e4035";

            ctx.save();
            ctx.fillStyle = cardColor;

            const minC = previewBounds.minCol;
            const maxC = previewBounds.maxCol;
            const minR = previewBounds.minRow;
            const maxR = previewBounds.maxRow;

            const cornerCoords = [
              { c: minC, r: minR }, { c: minC + 1, r: minR }, { c: minC, r: minR + 1 },
              { c: maxC, r: minR }, { c: maxC - 1, r: minR }, { c: maxC, r: minR + 1 },
              { c: minC, r: maxR }, { c: minC + 1, r: maxR }, { c: minC, r: maxR - 1 },
              { c: maxC, r: maxR }, { c: maxC - 1, r: maxR }, { c: maxC, r: maxR - 1 }
            ];

            for (const pt of cornerCoords) {
              const screenX = pt.c * GRID_SIZE - scrollX;
              const screenY = pt.r * GRID_SIZE - scrollY;

              if (
                screenX + GRID_SIZE >= 0 &&
                screenX <= viewWidth &&
                screenY + GRID_SIZE >= 0 &&
                screenY <= viewHeight
              ) {
                ctx.fillRect(screenX + 1, screenY + 1, GRID_SIZE - 1, GRID_SIZE - 1);
              }
            }

            const anchorX = hoverGridPos.col * GRID_SIZE - scrollX;
            const anchorY = hoverGridPos.row * GRID_SIZE - scrollY;
            ctx.fillRect(anchorX + 1, anchorY + 1, GRID_SIZE - 1, GRID_SIZE - 1);
            ctx.restore();
          }
        }
      } else {
        document.body.style.cursor = "default";
      }
    } else {
      document.body.style.cursor = "default";
    }

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();