import { Injectable } from '@angular/core';
import * as THREE from 'three';
import {
  ApplianceItem,
  ApplianceFinish
} from '../models/melamine.models';

@Injectable({
  providedIn: 'root'
})
export class Appliance3dBuilderService {

  /**
   * Builds a high-fidelity parametric 3D model for an appliance item.
   * Origin (0,0,0) is centered in X and Z, and at the bottom (Y=0) of the appliance bounding box.
   */
  buildApplianceGroup(appliance: ApplianceItem): THREE.Group {
    const group = new THREE.Group();
    group.name = `appliance_${appliance.id}`;

    const { width: w, depth: d, height: h, finish, type } = appliance;

    // Materials based on finish
    const bodyMat = this.createFinishMaterial(finish);
    const accentMat = this.createAccentMaterial(finish);
    const darkGlassMat = new THREE.MeshStandardMaterial({
      color: 0x11161d,
      roughness: 0.12,
      metalness: 0.2,
      transparent: true,
      opacity: 0.92
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xefefef,
      metalness: 0.92,
      roughness: 0.18
    });
    const castIronMat = new THREE.MeshStandardMaterial({
      color: 0x222326,
      metalness: 0.25,
      roughness: 0.8
    });
    const ledBlueMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const ledOrangeMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });

    // Build specific appliance geometry
    switch (type) {
      case 'refrigerator':
        this.buildRefrigerator(group, w, h, d, bodyMat, accentMat, chromeMat, ledBlueMat);
        break;
      case 'oven':
        this.buildOven(group, w, h, d, bodyMat, accentMat, darkGlassMat, chromeMat, ledBlueMat);
        break;
      case 'cooktop':
        this.buildCooktop(group, w, h, d, bodyMat, accentMat, darkGlassMat, castIronMat, ledOrangeMat);
        break;
      case 'hood':
        this.buildHood(group, w, h, d, bodyMat, accentMat, chromeMat, ledBlueMat);
        break;
      case 'sink':
        this.buildSink(group, w, h, d, bodyMat, chromeMat);
        break;
      case 'microwave':
        this.buildMicrowave(group, w, h, d, bodyMat, accentMat, darkGlassMat, chromeMat, ledBlueMat);
        break;
      default:
        this.buildGenericBox(group, w, h, d, bodyMat);
    }

    // Comprehensive transparent raycast hit box enclosing the entire parametric envelope
    const hitGeo = new THREE.BoxGeometry(w, h, d);
    const hitMat = new THREE.MeshBasicMaterial({
      visible: false,
      transparent: true,
      opacity: 0
    });
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.position.set(0, h / 2, 0);
    hitMesh.userData = { isApplianceHitBox: true, applianceId: appliance.id, appliance };
    group.add(hitMesh);

    // Tag entire group and its children with appliance metadata for raycasting
    group.userData = { isAppliance: true, applianceId: appliance.id, appliance };
    group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.userData = { ...child.userData, isAppliance: true, applianceId: appliance.id, appliance };
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return group;
  }

  // --- MATERIAL FACTORY ---

  private createFinishMaterial(finish: ApplianceFinish): THREE.MeshStandardMaterial {
    switch (finish) {
      case 'stainless_steel':
        return new THREE.MeshStandardMaterial({
          color: 0xc8cbd0,
          metalness: 0.85,
          roughness: 0.28
        });
      case 'black_matte':
        return new THREE.MeshStandardMaterial({
          color: 0x1e2022,
          metalness: 0.22,
          roughness: 0.55
        });
      case 'white_gloss':
        return new THREE.MeshStandardMaterial({
          color: 0xf5f6f8,
          metalness: 0.08,
          roughness: 0.15
        });
    }
  }

  private createAccentMaterial(finish: ApplianceFinish): THREE.MeshStandardMaterial {
    if (finish === 'stainless_steel') {
      return new THREE.MeshStandardMaterial({
        color: 0x33363a,
        metalness: 0.4,
        roughness: 0.4
      });
    }
    return new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      metalness: 0.85,
      roughness: 0.25
    });
  }

  // --- PROCEDURAL APPLIANCE BUILDERS ---

  private buildRefrigerator(
    group: THREE.Group,
    w: number,
    h: number,
    d: number,
    bodyMat: THREE.Material,
    accentMat: THREE.Material,
    chromeMat: THREE.Material,
    ledMat: THREE.Material
  ) {
    const kickH = Math.min(80, h * 0.05);
    const bodyH = h - kickH;
    const bodyD = d - 25; // Main box depth, doors protrude 25mm

    // 1. Kickplate / base grill
    const kickGeo = new THREE.BoxGeometry(w - 20, kickH, d - 40);
    const kickMesh = new THREE.Mesh(kickGeo, accentMat);
    kickMesh.position.set(0, kickH / 2, -10);
    group.add(kickMesh);

    // 2. Main cabinet body
    const bodyGeo = new THREE.BoxGeometry(w, bodyH, bodyD);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.set(0, kickH + bodyH / 2, -12.5);
    group.add(bodyMesh);

    // 3. Doors & Compartments
    const doorThickness = 24;
    const doorPosZ = (d / 2) - (doorThickness / 2);

    if (w >= 780) {
      // FRENCH DOOR: 2 Upper Doors + 1 Lower Freezer Drawer
      const freezerH = bodyH * 0.36;
      const upperH = bodyH - freezerH - 8;
      const halfW = (w - 6) / 2;

      // Left Upper Door
      const leftDoorGeo = new THREE.BoxGeometry(halfW, upperH, doorThickness);
      const leftDoor = new THREE.Mesh(leftDoorGeo, bodyMat);
      leftDoor.position.set(-halfW / 2 - 1.5, kickH + freezerH + 8 + upperH / 2, doorPosZ);
      group.add(leftDoor);

      // Right Upper Door
      const rightDoorGeo = new THREE.BoxGeometry(halfW, upperH, doorThickness);
      const rightDoor = new THREE.Mesh(rightDoorGeo, bodyMat);
      rightDoor.position.set(halfW / 2 + 1.5, kickH + freezerH + 8 + upperH / 2, doorPosZ);
      group.add(rightDoor);

      // Water/Ice Dispenser on Left Door
      const dispW = 140;
      const dispH = 200;
      const dispGeo = new THREE.BoxGeometry(dispW, dispH, 8);
      const dispMesh = new THREE.Mesh(dispGeo, accentMat);
      dispMesh.position.set(-halfW / 2 - 1.5, kickH + freezerH + 8 + upperH * 0.58, doorPosZ + doorThickness / 2);
      group.add(dispMesh);

      // Dispenser LED status indicator
      const dispLedGeo = new THREE.PlaneGeometry(35, 12);
      const dispLedMesh = new THREE.Mesh(dispLedGeo, ledMat);
      dispLedMesh.position.set(-halfW / 2 - 1.5, kickH + freezerH + 8 + upperH * 0.58 + 70, doorPosZ + doorThickness / 2 + 4.2);
      group.add(dispLedMesh);

      // Vertical Handles for French Doors (tubular bar)
      const handleH = upperH * 0.65;
      const handleGeo = new THREE.CylinderGeometry(8, 8, handleH, 16);
      
      const leftHandle = new THREE.Mesh(handleGeo, chromeMat);
      leftHandle.position.set(-18, kickH + freezerH + 8 + upperH / 2, doorPosZ + doorThickness / 2 + 20);
      group.add(leftHandle);

      const rightHandle = new THREE.Mesh(handleGeo, chromeMat);
      rightHandle.position.set(18, kickH + freezerH + 8 + upperH / 2, doorPosZ + doorThickness / 2 + 20);
      group.add(rightHandle);

      // Lower Freezer Drawer
      const freezerGeo = new THREE.BoxGeometry(w - 4, freezerH, doorThickness);
      const freezerMesh = new THREE.Mesh(freezerGeo, bodyMat);
      freezerMesh.position.set(0, kickH + freezerH / 2, doorPosZ);
      group.add(freezerMesh);

      // Horizontal Handle for Freezer
      const fHandleGeo = new THREE.CylinderGeometry(8, 8, w * 0.6, 16);
      const fHandleMesh = new THREE.Mesh(fHandleGeo, chromeMat);
      fHandleMesh.rotation.z = Math.PI / 2;
      fHandleMesh.position.set(0, kickH + freezerH - 40, doorPosZ + doorThickness / 2 + 20);
      group.add(fHandleMesh);

    } else {
      // 2-DOOR VERTICAL (COMBI / TOP-MOUNT)
      const freezerH = bodyH * 0.38;
      const fridgeH = bodyH - freezerH - 6;

      // Bottom Door
      const botDoorGeo = new THREE.BoxGeometry(w - 4, freezerH, doorThickness);
      const botDoor = new THREE.Mesh(botDoorGeo, bodyMat);
      botDoor.position.set(0, kickH + freezerH / 2, doorPosZ);
      group.add(botDoor);

      // Top Door
      const topDoorGeo = new THREE.BoxGeometry(w - 4, fridgeH, doorThickness);
      const topDoor = new THREE.Mesh(topDoorGeo, bodyMat);
      topDoor.position.set(0, kickH + freezerH + 6 + fridgeH / 2, doorPosZ);
      group.add(topDoor);

      // Side sleek integrated handles / bar handles
      const hTopGeo = new THREE.CylinderGeometry(7, 7, fridgeH * 0.5, 16);
      const hTopMesh = new THREE.Mesh(hTopGeo, chromeMat);
      hTopMesh.position.set(w / 2 - 35, kickH + freezerH + 6 + fridgeH * 0.35, doorPosZ + doorThickness / 2 + 18);
      group.add(hTopMesh);

      const hBotGeo = new THREE.CylinderGeometry(7, 7, freezerH * 0.5, 16);
      const hBotMesh = new THREE.Mesh(hBotGeo, chromeMat);
      hBotMesh.position.set(w / 2 - 35, kickH + freezerH * 0.65, doorPosZ + doorThickness / 2 + 18);
      group.add(hBotMesh);
    }
  }

  private buildOven(
    group: THREE.Group,
    w: number,
    h: number,
    d: number,
    bodyMat: THREE.Material,
    accentMat: THREE.Material,
    darkGlassMat: THREE.Material,
    chromeMat: THREE.Material,
    ledMat: THREE.Material
  ) {
    // 1. Recessed Oven Chassis (fits into cabinet)
    const chassisW = w - 30;
    const chassisH = h - 30;
    const chassisD = d - 24;
    const chassisGeo = new THREE.BoxGeometry(chassisW, chassisH, chassisD);
    const chassisMesh = new THREE.Mesh(chassisGeo, accentMat);
    chassisMesh.position.set(0, h / 2, -12);
    group.add(chassisMesh);

    // 2. Front Trim Surround Frame
    const frontFrameGeo = new THREE.BoxGeometry(w, h, 20);
    const frontFrameMesh = new THREE.Mesh(frontFrameGeo, bodyMat);
    frontFrameMesh.position.set(0, h / 2, (d / 2) - 10);
    group.add(frontFrameMesh);

    // 3. Top Control Fascia
    const fasciaH = Math.max(90, h * 0.2);
    const fasciaGeo = new THREE.BoxGeometry(w - 16, fasciaH, 6);
    const fasciaMesh = new THREE.Mesh(fasciaGeo, darkGlassMat);
    fasciaMesh.position.set(0, h - fasciaH / 2 - 10, (d / 2) + 2);
    group.add(fasciaMesh);

    // Digital LED clock in fascia
    const clockGeo = new THREE.PlaneGeometry(60, 24);
    const clockMesh = new THREE.Mesh(clockGeo, ledMat);
    clockMesh.position.set(0, h - fasciaH / 2 - 10, (d / 2) + 5.5);
    group.add(clockMesh);

    // Dual Rotary Dial Knobs
    const knobGeo = new THREE.CylinderGeometry(18, 18, 12, 24);
    const knobLeft = new THREE.Mesh(knobGeo, chromeMat);
    knobLeft.rotation.x = Math.PI / 2;
    knobLeft.position.set(-w / 2 + 65, h - fasciaH / 2 - 10, (d / 2) + 8);
    group.add(knobLeft);

    const knobRight = new THREE.Mesh(knobGeo, chromeMat);
    knobRight.rotation.x = Math.PI / 2;
    knobRight.position.set(w / 2 - 65, h - fasciaH / 2 - 10, (d / 2) + 8);
    group.add(knobRight);

    // 4. Large Dark Tempered Glass Oven Door
    const doorH = h - fasciaH - 26;
    const doorGeo = new THREE.BoxGeometry(w - 20, doorH, 10);
    const doorMesh = new THREE.Mesh(doorGeo, darkGlassMat);
    doorMesh.position.set(0, doorH / 2 + 10, (d / 2) + 4);
    group.add(doorMesh);

    // Inner Inspection Glass Window (slightly clearer inner pane)
    const winGeo = new THREE.BoxGeometry(w * 0.65, doorH * 0.62, 12);
    const winMesh = new THREE.Mesh(winGeo, darkGlassMat);
    winMesh.position.set(0, doorH / 2 + 10, (d / 2) + 4);
    group.add(winMesh);

    // 5. Heavy-Duty Horizontal Tubular Handle
    const handleLen = w * 0.72;
    const handleGeo = new THREE.CylinderGeometry(9, 9, handleLen, 20);
    const handleMesh = new THREE.Mesh(handleGeo, chromeMat);
    handleMesh.rotation.z = Math.PI / 2;
    handleMesh.position.set(0, doorH + 2, (d / 2) + 32);
    group.add(handleMesh);

    // Standoff brackets connecting handle to door
    const bracketGeo = new THREE.BoxGeometry(16, 12, 24);
    const bLeft = new THREE.Mesh(bracketGeo, chromeMat);
    bLeft.position.set(-handleLen / 2 + 20, doorH + 2, (d / 2) + 20);
    group.add(bLeft);

    const bRight = new THREE.Mesh(bracketGeo, chromeMat);
    bRight.position.set(handleLen / 2 - 20, doorH + 2, (d / 2) + 20);
    group.add(bRight);
  }

  private buildCooktop(
    group: THREE.Group,
    w: number,
    h: number,
    d: number,
    bodyMat: THREE.Material,
    accentMat: THREE.Material,
    darkGlassMat: THREE.Material,
    castIronMat: THREE.Material,
    ledOrangeMat: THREE.Material
  ) {
    const isGas = w > 750 || bodyMat instanceof THREE.MeshStandardMaterial && (bodyMat.color.getHex() === 0xc8cbd0);

    // 1. Lower drop-in box (sits beneath countertop)
    const dropGeo = new THREE.BoxGeometry(w - 40, h - 15, d - 40);
    const dropMesh = new THREE.Mesh(dropGeo, accentMat);
    dropMesh.position.set(0, (h - 15) / 2, 0);
    group.add(dropMesh);

    // 2. Top Plate Surface (Glass or Stainless)
    const plateGeo = new THREE.BoxGeometry(w, 14, d);
    const plateMesh = new THREE.Mesh(plateGeo, isGas ? bodyMat : darkGlassMat);
    plateMesh.position.set(0, h - 7, 0);
    group.add(plateMesh);

    if (!isGas) {
      // INDUCTION / VITROCERAMIC: Concentric cooking rings & Touch sliders
      const zones = [
        { x: -w * 0.24, z: -d * 0.22, r: Math.min(w, d) * 0.2 },
        { x: w * 0.24, z: -d * 0.22, r: Math.min(w, d) * 0.16 },
        { x: -w * 0.24, z: d * 0.22, r: Math.min(w, d) * 0.15 },
        { x: w * 0.24, z: d * 0.2, r: Math.min(w, d) * 0.22 },
      ];

      zones.forEach(z => {
        // Outer ring
        const ringGeo = new THREE.RingGeometry(z.r - 4, z.r, 32);
        const ringMesh = new THREE.Mesh(ringGeo, ledOrangeMat);
        ringMesh.rotation.x = -Math.PI / 2;
        ringMesh.position.set(z.x, h + 0.5, z.z);
        group.add(ringMesh);

        // Center crosshair / dot
        const dotGeo = new THREE.CircleGeometry(8, 16);
        const dotMesh = new THREE.Mesh(dotGeo, ledOrangeMat);
        dotMesh.rotation.x = -Math.PI / 2;
        dotMesh.position.set(z.x, h + 0.5, z.z);
        group.add(dotMesh);
      });

      // Front Touch Controls Bar
      const touchGeo = new THREE.PlaneGeometry(w * 0.35, 22);
      const touchMesh = new THREE.Mesh(touchGeo, ledOrangeMat);
      touchMesh.rotation.x = -Math.PI / 2;
      touchMesh.position.set(0, h + 0.5, d * 0.38);
      group.add(touchMesh);

    } else {
      // GAS COOKTOP: Cast-Iron Burner Grates & Brass Caps & Knobs
      const burners = [
        { x: -w * 0.26, z: -d * 0.22, r: 40 },
        { x: w * 0.26, z: -d * 0.22, r: 40 },
        { x: 0, z: 0, r: 55 }, // Center Wok Burner
        { x: -w * 0.26, z: d * 0.22, r: 35 },
        { x: w * 0.26, z: d * 0.22, r: 35 },
      ];

      burners.forEach(b => {
        // Burner Base Cap
        const capGeo = new THREE.CylinderGeometry(b.r, b.r + 5, 8, 24);
        const capMesh = new THREE.Mesh(capGeo, castIronMat);
        capMesh.position.set(b.x, h + 4, b.z);
        group.add(capMesh);

        // 4-finger cross grate
        const grateSize = b.r * 2.1;
        const barGeo1 = new THREE.BoxGeometry(grateSize, 8, 10);
        const barMesh1 = new THREE.Mesh(barGeo1, castIronMat);
        barMesh1.position.set(b.x, h + 10, b.z);
        group.add(barMesh1);

        const barGeo2 = new THREE.BoxGeometry(10, 8, grateSize);
        const barMesh2 = new THREE.Mesh(barGeo2, castIronMat);
        barMesh2.position.set(b.x, h + 10, b.z);
        group.add(barMesh2);
      });

      // Front Control Knobs (5 knobs along front edge)
      const knobSpacing = (w * 0.45) / 4;
      for (let i = 0; i < 5; i++) {
        const kx = -((w * 0.45) / 2) + i * knobSpacing;
        const knobGeo = new THREE.CylinderGeometry(12, 12, 10, 16);
        const knobMesh = new THREE.Mesh(knobGeo, bodyMat);
        knobMesh.position.set(kx, h + 5, d * 0.38);
        group.add(knobMesh);
      }
    }
  }

  private buildHood(
    group: THREE.Group,
    w: number,
    h: number,
    d: number,
    bodyMat: THREE.Material,
    accentMat: THREE.Material,
    chromeMat: THREE.Material,
    ledMat: THREE.Material
  ) {
    const canopyH = 55; // Bottom canopy thickness
    const chimneyW = Math.min(320, w * 0.38);
    const chimneyD = Math.min(280, d * 0.55);
    const chimneyH = h - canopyH;

    // 1. Lower Canopy
    const canopyGeo = new THREE.BoxGeometry(w, canopyH, d);
    const canopyMesh = new THREE.Mesh(canopyGeo, bodyMat);
    canopyMesh.position.set(0, canopyH / 2, 0);
    group.add(canopyMesh);

    // Front Control Strip
    const btnStripGeo = new THREE.BoxGeometry(w * 0.35, 14, 3);
    const btnStrip = new THREE.Mesh(btnStripGeo, accentMat);
    btnStrip.position.set(0, canopyH / 2, (d / 2) + 1.6);
    group.add(btnStrip);

    // 2. Underside Grease Filters (Aluminum Mesh Panels)
    const filterW = (w - 60) / 2;
    const filterD = d - 80;
    const filterGeo = new THREE.BoxGeometry(filterW, 4, filterD);
    const filterMat = new THREE.MeshStandardMaterial({
      color: 0x9ca3af,
      metalness: 0.8,
      roughness: 0.4
    });

    const filterLeft = new THREE.Mesh(filterGeo, filterMat);
    filterLeft.position.set(-filterW / 2 - 5, -2, 0);
    canopyMesh.add(filterLeft);

    const filterRight = new THREE.Mesh(filterGeo, filterMat);
    filterRight.position.set(filterW / 2 + 5, -2, 0);
    canopyMesh.add(filterRight);

    // Downlight Spotlight LEDs
    const lightGeo = new THREE.CircleGeometry(16, 16);
    const spotLeft = new THREE.Mesh(lightGeo, ledMat);
    spotLeft.rotation.x = Math.PI / 2;
    spotLeft.position.set(-w * 0.35, -2.5, -d * 0.25);
    canopyMesh.add(spotLeft);

    const spotRight = new THREE.Mesh(lightGeo, ledMat);
    spotRight.rotation.x = Math.PI / 2;
    spotRight.position.set(w * 0.35, -2.5, -d * 0.25);
    canopyMesh.add(spotRight);

    // 3. Telescopic Vertical Chimney Duct
    const chimneyGeo = new THREE.BoxGeometry(chimneyW, chimneyH, chimneyD);
    const chimneyMesh = new THREE.Mesh(chimneyGeo, bodyMat);
    chimneyMesh.position.set(0, canopyH + chimneyH / 2, -10);
    group.add(chimneyMesh);

    // Top Duct Vent Grille
    const ventGeo = new THREE.BoxGeometry(chimneyW - 20, 20, 4);
    const ventMesh = new THREE.Mesh(ventGeo, accentMat);
    ventMesh.position.set(0, canopyH + chimneyH - 25, -10 + (chimneyD / 2) + 2);
    group.add(ventMesh);
  }

  private buildSink(
    group: THREE.Group,
    w: number,
    h: number,
    d: number,
    bodyMat: THREE.Material,
    chromeMat: THREE.Material
  ) {
    const rimH = 12;
    const bowlDepth = Math.max(160, h - rimH);

    // 1. Countertop Outer Flange Rim
    const rimGeo = new THREE.BoxGeometry(w, rimH, d);
    const rimMesh = new THREE.Mesh(rimGeo, bodyMat);
    rimMesh.position.set(0, h - rimH / 2, 0);
    group.add(rimMesh);

    // 2. Recessed Sink Bowl(s)
    const isDouble = w >= 780 && !w.toString().includes('single');
    const innerD = d - 70;

    if (!isDouble) {
      // SINGLE LARGE BOWL
      const bowlW = w * 0.68;
      const bowlGeo = new THREE.BoxGeometry(bowlW, bowlDepth, innerD);
      const bowlMesh = new THREE.Mesh(bowlGeo, bodyMat);
      bowlMesh.position.set(-w * 0.12, (h - rimH) / 2, 0);
      group.add(bowlMesh);

      // Drain basket strainer
      const drainGeo = new THREE.CylinderGeometry(40, 36, 6, 24);
      const drainMesh = new THREE.Mesh(drainGeo, chromeMat);
      drainMesh.position.set(-w * 0.12, h - rimH - bowlDepth + 4, 0);
      group.add(drainMesh);

      // Right-side grooved draining board (escurridor)
      const drainBoardGeo = new THREE.BoxGeometry(w * 0.28, 6, innerD);
      const drainBoard = new THREE.Mesh(drainBoardGeo, bodyMat);
      drainBoard.position.set(w * 0.32, h - 3, 0);
      group.add(drainBoard);

    } else {
      // DOUBLE EQUAL BOWLS
      const halfBowlW = (w - 70) / 2;

      // Left Bowl
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(halfBowlW, bowlDepth, innerD), bodyMat);
      b1.position.set(-halfBowlW / 2 - 10, (h - rimH) / 2, 0);
      group.add(b1);

      // Right Bowl
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(halfBowlW, bowlDepth, innerD), bodyMat);
      b2.position.set(halfBowlW / 2 + 10, (h - rimH) / 2, 0);
      group.add(b2);

      // Strainers in both bowls
      const d1 = new THREE.Mesh(new THREE.CylinderGeometry(38, 34, 6, 24), chromeMat);
      d1.position.set(-halfBowlW / 2 - 10, h - rimH - bowlDepth + 4, 0);
      group.add(d1);

      const d2 = new THREE.Mesh(new THREE.CylinderGeometry(38, 34, 6, 24), chromeMat);
      d2.position.set(halfBowlW / 2 + 10, h - rimH - bowlDepth + 4, 0);
      group.add(d2);
    }

    // 3. Swivel Gooseneck Designer Faucet (Escalado Armónico y Proporcional)
    const faucetGroup = new THREE.Group();
    const fScale = Math.max(0.55, Math.min(1.7, Math.min(w / 800, d / 480)));
    faucetGroup.scale.set(fScale, fScale, fScale);
    faucetGroup.position.set(0, h, -d / 2 + 38 * fScale);

    // Faucet Base Hub
    const fBase = new THREE.Mesh(new THREE.CylinderGeometry(22, 24, 30, 20), chromeMat);
    fBase.position.y = 15;
    faucetGroup.add(fBase);

    // Single lever mixer joystick handle
    const fLever = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 60, 16), chromeMat);
    fLever.rotation.z = Math.PI / 4;
    fLever.position.set(22, 35, 0);
    faucetGroup.add(fLever);

    // Tall curved neck (using torus arc + vertical stem)
    const fStem = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 190, 20), chromeMat);
    fStem.position.y = 110;
    faucetGroup.add(fStem);

    // Curved gooseneck spout arch
    const archGeo = new THREE.TorusGeometry(60, 11, 16, 24, Math.PI);
    const archMesh = new THREE.Mesh(archGeo, chromeMat);
    archMesh.rotation.y = -Math.PI / 2;
    archMesh.position.set(0, 205, 60);
    faucetGroup.add(archMesh);

    // Aerator nozzle tip
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(12, 10, 26, 16), chromeMat);
    nozzle.position.set(0, 190, 120);
    faucetGroup.add(nozzle);

    group.add(faucetGroup);
  }

  private buildMicrowave(
    group: THREE.Group,
    w: number,
    h: number,
    d: number,
    bodyMat: THREE.Material,
    accentMat: THREE.Material,
    darkGlassMat: THREE.Material,
    chromeMat: THREE.Material,
    ledMat: THREE.Material
  ) {
    // 1. Main outer casing
    const bodyGeo = new THREE.BoxGeometry(w, h, d);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.set(0, h / 2, 0);
    group.add(bodyMesh);

    // 2. Front Door & Right Control Panel
    const doorW = w * 0.72;
    const panelW = w - doorW - 14;
    const frontD = (d / 2) + 2;

    // Dark Glass Door with frame
    const doorGeo = new THREE.BoxGeometry(doorW, h - 20, 10);
    const doorMesh = new THREE.Mesh(doorGeo, darkGlassMat);
    doorMesh.position.set(-w / 2 + doorW / 2 + 10, h / 2, frontD);
    group.add(doorMesh);

    // Inner patterned viewing grid on door
    const winGeo = new THREE.BoxGeometry(doorW * 0.76, (h - 20) * 0.72, 12);
    const winMesh = new THREE.Mesh(winGeo, darkGlassMat);
    winMesh.position.set(-w / 2 + doorW / 2 + 10, h / 2, frontD);
    group.add(winMesh);

    // Sleek vertical door handle
    const handleGeo = new THREE.CylinderGeometry(7, 7, h * 0.5, 16);
    const handleMesh = new THREE.Mesh(handleGeo, chromeMat);
    handleMesh.position.set(-w / 2 + doorW - 10, h / 2, frontD + 16);
    group.add(handleMesh);

    // 3. Right Control Panel
    const panelGeo = new THREE.BoxGeometry(panelW, h - 20, 8);
    const panelMesh = new THREE.Mesh(panelGeo, accentMat);
    panelMesh.position.set(w / 2 - panelW / 2 - 8, h / 2, frontD);
    group.add(panelMesh);

    // Digital LED display clock
    const dispGeo = new THREE.PlaneGeometry(panelW * 0.8, 24);
    const dispMesh = new THREE.Mesh(dispGeo, ledMat);
    dispMesh.position.set(w / 2 - panelW / 2 - 8, h - 45, frontD + 4.5);
    group.add(dispMesh);

    // Rotary Dial or Touch Keypad Row
    const knobGeo = new THREE.CylinderGeometry(16, 16, 10, 20);
    const knobMesh = new THREE.Mesh(knobGeo, chromeMat);
    knobMesh.rotation.x = Math.PI / 2;
    knobMesh.position.set(w / 2 - panelW / 2 - 8, h / 2 - 20, frontD + 6);
    group.add(knobMesh);

    // Push Open Button
    const btnGeo = new THREE.BoxGeometry(panelW * 0.8, 22, 6);
    const btnMesh = new THREE.Mesh(btnGeo, chromeMat);
    btnMesh.position.set(w / 2 - panelW / 2 - 8, 35, frontD + 4);
    group.add(btnMesh);
  }

  private buildGenericBox(group: THREE.Group, w: number, h: number, d: number, bodyMat: THREE.Material) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, bodyMat);
    mesh.position.set(0, h / 2, 0);
    group.add(mesh);
  }
}
