// Catalogue navigation art reused from the reviewed Explore reference.
export function productIcon(id) {
  const paths = {
    kettle: '<path d="M16 25h23l4 25H12l4-25Zm4-6h15m-18 6-5-9-6 3 7 13m28-4h4a8 8 0 0 1 0 16h-3"/><path d="M12 55h34"/>',
    fan: '<circle cx="30" cy="24" r="19"/><path d="M25 45v11h10V45M16 58h28"/><path d="M30 24c-14 0-11-13-4-13 8 0 4 13 4 13Zm0 0c5-12 16-5 13 1-3 7-13-1-13-1Zm0 0c7 10-5 17-9 12-5-6 9-12 9-12Z"/>',
    toaster: '<rect x="9" y="22" width="43" height="30" rx="7"/><path d="M17 22v-7h25v7M17 55h27M44 33v9m-5-5h10"/>',
    blender: '<path d="m18 12 3 25h20l3-25H18ZM17 9h28M22 39h18l7 17H15l7-17ZM44 17h6v14h-8"/><circle cx="31" cy="49" r="3"/>',
    microwave: '<rect x="6" y="15" width="49" height="34" rx="4"/><rect x="11" y="20" width="31" height="24" rx="2"/><path d="M48 23h2m-2 6h2m-2 7h2M11 53h38"/>',
    vacuum: '<rect x="8" y="31" width="25" height="23" rx="9"/><path d="M23 31V19c0-13 21-13 21 0v24m-6 10 6-10 8 10H38Z"/><circle cx="15" cy="54" r="4"/>',
    hairdryer: '<path d="M14 16h26l9 8-9 9H14a8 8 0 0 1 0-17Zm6 17-2 23h10l4-23M49 20h8v9h-8"/><path d="M12 21v8m5-8v8"/>',
    laptop: '<rect x="12" y="11" width="39" height="29" rx="3"/><path d="M12 40 4 51h55l-8-11M23 47h17"/>',
    ricecooker: '<path d="M11 24h42v23a7 7 0 0 1-7 7H18a7 7 0 0 1-7-7V24Zm0 0c0-15 42-15 42 0M25 12V8h13v4M7 30H3v12h8m42-12h8v12h-8M20 57v3m24-3v3"/><rect x="24" y="35" width="15" height="10" rx="3"/>',
    airfryer: '<rect x="12" y="8" width="40" height="48" rx="12"/><path d="M15 31h34M26 21h12M24 39h16v8H24ZM22 60h21"/>',
    coffeemachine: '<path d="M13 8h35v47H13V8Zm4 20h27M18 50h25M25 30v6m11-6v6M23 39h16v10H23Z"/><path d="M48 13h9v29h-9M24 17h2m10 0h2M9 59h43"/>',
    mixer: '<path d="M17 12h26a8 8 0 0 1 0 16H17V12ZM19 28v26h28M14 54h37v5H14ZM34 28v10m-8 0h20c0 15-20 15-20 0Z"/><circle cx="23" cy="20" r="3"/>',
    smartphone: '<rect x="19" y="5" width="26" height="54" rx="5"/><path d="M27 10h10M28 53h8"/>',
    tablet: '<rect x="11" y="5" width="42" height="54" rx="4"/><path d="M17 12h30v36H17zM29 53h6"/>',
    television: '<rect x="5" y="11" width="54" height="35" rx="3"/><path d="M11 17h42v23H11zM23 46l-5 9M41 46l5 9"/>',
    washing_machine: '<rect x="10" y="5" width="44" height="54" rx="4"/><path d="M10 18h44M17 12h12M43 12h3"/><circle cx="32" cy="37" r="13"/><path d="M21 38c9-7 13 7 22 0"/>',
    // Each navigation drawing leads to its own semantic, interactive 3D model.
    refrigerator: '<rect x="15" y="4" width="34" height="54" rx="3"/><path d="M15 24h34M21 12v7m0 12v13M20 58v3m24-3v3"/>',
    food_processor: '<path d="M11 33h28v20H11zM15 30V15h25v17M14 12h29M29 12V5h8v7M40 17h9v12h-9M39 36l10 17H10"/><circle cx="23" cy="43" r="3"/><path d="M24 21h9m-5-6v14"/>',
    sandwich_press: '<path d="m11 29 6-15h30l7 15H11Zm0 5h43v13H11zM18 51h29M22 20h18M15 29v5m34-5v5M22 40h18"/>',
    portable_heater: '<rect x="11" y="9" width="42" height="45" rx="4"/><path d="M18 17v27m7-27v27m7-27v27m7-27v27m7-27v27M17 54v6m30-6v6"/>',
    portable_ac: '<rect x="12" y="7" width="36" height="49" rx="6"/><path d="M20 16h20m-20 6h20m-20 6h20M21 46h18M48 39h6c7 0 7-16 2-16M19 56v4m22-4v4"/>',
    dehumidifier: '<rect x="14" y="7" width="36" height="50" rx="7"/><path d="M23 14h18M20 23h24m-24 6h24M14 39h36"/><path d="M32 43c-9 10 9 10 0 0Z"/>',
    headphones: '<path d="M10 36V26a22 22 0 0 1 44 0v10M17 30v-4a15 15 0 0 1 30 0v4"/><rect x="7" y="31" width="12" height="23" rx="5"/><rect x="45" y="31" width="12" height="23" rx="5"/>',
    games_console: '<path d="M12 7h22v30H12zM17 13h12m-12 5h12M41 7h11v29H41z"/><path d="M20 39h24c5 0 9 14 6 18-3 4-9-7-13-7H27c-4 0-10 11-13 7-3-4 1-18 6-18Z"/><path d="M21 43v7m-4-3h8m13-3h1m5 3h1"/>',
    printer: '<path d="M17 22V6h30v16M17 45H8V22h48v23h-9M17 36h30v22H17V36ZM23 43h18m-18 7h18"/><circle cx="48" cy="29" r="1"/>',
    steam_cleaner: '<path d="M30 7h13v6H30zM35 13l-7 24m-6-2 15 4-5 13H18l4-17Zm-8 17h25l8 8H8l6-8Z"/><path d="M44 43c-5-5 5-7 0-12m8 16c-5-5 5-7 0-12"/>',
    clothes_dryer: '<rect x="10" y="5" width="44" height="54" rx="4"/><path d="M10 18h44M17 12h12M43 12h3"/><circle cx="32" cy="37" r="13"/><path d="M27 45c-5-5 5-7 0-14m9 14c-5-5 5-7 0-14"/>',
    straightener: '<path d="M15 9h8l14 41-7 3L15 9Zm33 0h-8L29 50l7 3L48 9ZM19 15l7 23m18-23-7 23M32 55v5"/><circle cx="32" cy="52" r="4"/>',
    shaver: '<rect x="18" y="7" width="28" height="17" rx="5"/><path d="M21 24v25a11 11 0 0 0 22 0V24M24 12v7m8-7v7m8-7v7"/><circle cx="32" cy="37" r="3"/>',
    electric_toothbrush: '<rect x="27" y="4" width="10" height="16" rx="3"/><path d="M37 7h5m-5 4h5m-5 4h5M30 20v10m5-10v10"/><rect x="25" y="30" width="15" height="30" rx="6"/><circle cx="32.5" cy="39" r="2"/>',
    cordless_drill: '<path d="M9 12h30l8 7v13H9V12ZM47 19h9v9h-9m9-5h6M22 32l-4 17h16l4-17M14 49h25v10H14V49ZM27 32v6h9"/><path d="M15 18h12m-12 6h12"/>',
    sewing_machine: '<path d="M9 12h36a8 8 0 0 1 8 8v29H12v-8h24V27H21v9H9V12ZM7 49h50v9H7zM13 36v5m20-29V5h7v7"/><circle cx="46" cy="23" r="4"/>',
  };
  return `<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${paths[id] || '<rect x="13" y="13" width="38" height="38" rx="6"/><path d="M25 25a7 7 0 0 1 14 0c0 5-7 5-7 11M32 43v1"/>'}</svg>`;
}
