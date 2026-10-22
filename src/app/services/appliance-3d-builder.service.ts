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
      case 'coffee_maker':
        this.buildCoffeeMaker(group, w, h, d, bodyMat, accentMat, chromeMat, darkGlassMat, ledOrangeMat);
        break;
      case 'table_leg':
        this.buildTableLeg(group, appliance, w, h, d, bodyMat, accentMat, chromeMat);
        break;
      case 'table_legs_set':
        this.buildTableLegsSet(group, appliance, w, h, d, bodyMat, accentMat, chromeMat);
        break;
      case 'bar_stool':
        this.buildBarStool(group, w, h, d, bodyMat, accentMat, chromeMat);
        break;
      case 'dining_chair':
        this.buildDiningChair(group, w, h, d, bodyMat, accentMat, chromeMat);
        break;
      case 'dining_table':
        this.buildDiningTable(group, w, h, d, bodyMat, accentMat);
        break;
      case 'pendant_lamp':
        this.buildPendantLamp(group, appliance, w, h, d, bodyMat, accentMat, chromeMat);
        break;
      case 'window_frame':
        this.buildWindowFrame(group, w, h, d, bodyMat, chromeMat);
        break;
      case 'door_frame':
        this.buildDoorFrame(group, w, h, d, bodyMat, accentMat, chromeMat);
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
      case 'gold_brass':
        return new THREE.MeshStandardMaterial({
          color: 0xd4af37,
          metalness: 0.88,
          roughness: 0.25
        });
      case 'natural_wood':
        return new THREE.MeshStandardMaterial({
          color: 0xc19a6b,
          metalness: 0.05,
          roughness: 0.70
        });
      case 'retro_red':
        return new THREE.MeshStandardMaterial({
          color: 0x991b1b,
          metalness: 0.35,
          roughness: 0.30
        });
      default:
        return new THREE.MeshStandardMaterial({
          color: 0x94a3b8,
          metalness: 0.5,
          roughness: 0.4
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
    if (finish === 'natural_wood') {
      return new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        metalness: 0.85,
        roughness: 0.25
      });
    }
    if (finish === 'retro_red') {
      return new THREE.MeshStandardMaterial({
        color: 0xefefef,
        metalness: 0.90,
        roughness: 0.20
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

  // --- 7. CAFETERA ESPRESSO DE SOBREMESA / ENCIMERA ---

  private buildCoffeeMaker(
    group: THREE.Group,
    w: number,
    h: number,
    d: number,
    bodyMat: THREE.Material,
    accentMat: THREE.Material,
    chromeMat: THREE.Material,
    darkGlassMat: THREE.Material,
    ledMat: THREE.Material
  ) {
    // 1. Base Footing & Drip Basin
    const footH = 12;
    const footR = 10;
    const footOffsets = [
      { x: -w / 2 + 25, z: -d / 2 + 25 },
      { x: w / 2 - 25, z: -d / 2 + 25 },
      { x: -w / 2 + 25, z: d / 2 - 25 },
      { x: w / 2 - 25, z: d / 2 - 25 }
    ];
    for (const fo of footOffsets) {
      const footGeo = new THREE.CylinderGeometry(footR * 0.8, footR, footH, 16);
      const footMesh = new THREE.Mesh(footGeo, accentMat);
      footMesh.position.set(fo.x, footH / 2, fo.z);
      group.add(footMesh);
    }

    // Lower Drip Tray Assembly (Front lower 1/4)
    const dripTrayH = 34;
    const dripTrayD = d * 0.46;
    const dripTrayW = w * 0.92;
    const dripTrayPosZ = (d / 2) - (dripTrayD / 2);

    const dripBaseGeo = new THREE.BoxGeometry(dripTrayW, dripTrayH, dripTrayD);
    const dripBase = new THREE.Mesh(dripBaseGeo, bodyMat);
    dripBase.position.set(0, footH + dripTrayH / 2, dripTrayPosZ);
    group.add(dripBase);

    // Perforated Chrome Drip Grid
    const gridGeo = new THREE.BoxGeometry(dripTrayW - 12, 4, dripTrayD - 12);
    const gridMesh = new THREE.Mesh(gridGeo, chromeMat);
    gridMesh.position.set(0, footH + dripTrayH + 2, dripTrayPosZ);
    group.add(gridMesh);

    // Decorative drain slots on grid
    const slotCount = 6;
    const slotStep = (dripTrayW - 36) / (slotCount + 1);
    for (let i = 1; i <= slotCount; i++) {
      const slotX = - (dripTrayW - 36) / 2 + i * slotStep;
      const slotGeo = new THREE.BoxGeometry(2, 4.5, dripTrayD * 0.6);
      const slotMesh = new THREE.Mesh(slotGeo, accentMat);
      slotMesh.position.set(slotX, footH + dripTrayH + 2.2, dripTrayPosZ);
      group.add(slotMesh);
    }

    // 2. Main Machine Chassis / Body
    const bodyBaseY = footH;
    const mainBodyH = h - footH;
    const rearBodyD = d * 0.54;
    const rearBodyPosZ = - (d / 2) + (rearBodyD / 2);

    // Rear Tower / Boiler section
    const rearGeo = new THREE.BoxGeometry(w, mainBodyH, rearBodyD);
    const rearMesh = new THREE.Mesh(rearGeo, bodyMat);
    rearMesh.position.set(0, bodyBaseY + mainBodyH / 2, rearBodyPosZ);
    group.add(rearMesh);

    // Upper Overhanging Head Unit (houses group head & control panel)
    const headH = mainBodyH * 0.44;
    const headD = d * 0.44;
    const headW = w * 0.96;
    const headPosZ = dripTrayPosZ - 2;
    const headPosY = h - headH / 2;

    const headGeo = new THREE.BoxGeometry(headW, headH, headD);
    const headMesh = new THREE.Mesh(headGeo, bodyMat);
    headMesh.position.set(0, headPosY, headPosZ);
    group.add(headMesh);

    // 3. Front Control Panel Facia
    const faciaThick = 6;
    const faciaH = headH * 0.52;
    const faciaGeo = new THREE.BoxGeometry(headW - 8, faciaH, faciaThick);
    const faciaMesh = new THREE.Mesh(faciaGeo, chromeMat);
    faciaMesh.position.set(0, h - faciaH / 2 - 8, headPosZ + headD / 2 + faciaThick / 2);
    group.add(faciaMesh);

    // Analog Pressure Gauge (Barometer dial 9 bar)
    const gaugeR = Math.min(22, faciaH * 0.38);
    const gaugeRimGeo = new THREE.CylinderGeometry(gaugeR, gaugeR, 6, 24);
    const gaugeRim = new THREE.Mesh(gaugeRimGeo, chromeMat);
    gaugeRim.rotation.x = Math.PI / 2;
    gaugeRim.position.set(0, h - faciaH / 2 - 8, headPosZ + headD / 2 + faciaThick + 3);
    group.add(gaugeRim);

    const gaugeFaceGeo = new THREE.CylinderGeometry(gaugeR * 0.85, gaugeR * 0.85, 6.2, 24);
    const gaugeFaceMat = new THREE.MeshStandardMaterial({ color: 0xfefefe, roughness: 0.2 });
    const gaugeFace = new THREE.Mesh(gaugeFaceGeo, gaugeFaceMat);
    gaugeFace.rotation.x = Math.PI / 2;
    gaugeFace.position.set(0, h - faciaH / 2 - 8, headPosZ + headD / 2 + faciaThick + 3.2);
    group.add(gaugeFace);

    // Gauge Needle
    const needleGeo = new THREE.BoxGeometry(gaugeR * 0.65, 1.5, 6.6);
    const needleMat = new THREE.MeshBasicMaterial({ color: 0x991b1b });
    const needle = new THREE.Mesh(needleGeo, needleMat);
    needle.rotation.z = Math.PI / 4;
    needle.position.set(0, h - faciaH / 2 - 8, headPosZ + headD / 2 + faciaThick + 3.5);
    group.add(needle);

    // Push Buttons with LED rings (Power, 1-Cup, 2-Cups, Steam)
    const btnCount = 4;
    const btnSpacing = (headW * 0.72) / (btnCount + 1);
    for (let i = 1; i <= btnCount; i++) {
      if (i === 2 || i === 3) continue; // Leave center space for pressure gauge
      const btnX = - (headW * 0.72) / 2 + i * btnSpacing;
      const btnGeo = new THREE.CylinderGeometry(6, 6, 8, 16);
      const btnMesh = new THREE.Mesh(btnGeo, chromeMat);
      btnMesh.rotation.x = Math.PI / 2;
      btnMesh.position.set(btnX, h - faciaH / 2 - 8, headPosZ + headD / 2 + faciaThick + 4);
      group.add(btnMesh);

      const ledRing = new THREE.Mesh(new THREE.RingGeometry(6.2, 7.5, 16), ledMat);
      ledRing.position.set(btnX, h - faciaH / 2 - 8, headPosZ + headD / 2 + faciaThick + 4.2);
      group.add(ledRing);
    }

    // 4. Group Head & Portafilter (Portafiltro profesional)
    const groupHeadY = h - headH;
    const groupHeadGeo = new THREE.CylinderGeometry(28, 30, 24, 24);
    const groupHead = new THREE.Mesh(groupHeadGeo, chromeMat);
    groupHead.position.set(0, groupHeadY + 6, headPosZ + 10);
    group.add(groupHead);

    // Portafilter Basket Collar
    const basketGeo = new THREE.CylinderGeometry(26, 24, 18, 24);
    const basket = new THREE.Mesh(basketGeo, chromeMat);
    basket.position.set(0, groupHeadY - 10, headPosZ + 10);
    group.add(basket);

    // Dual Pouring Spouts (Picos de erogación dobles)
    const spoutLeftGeo = new THREE.CylinderGeometry(3.5, 2, 16, 12);
    const spoutLeft = new THREE.Mesh(spoutLeftGeo, chromeMat);
    spoutLeft.rotation.z = -0.15;
    spoutLeft.position.set(-8, groupHeadY - 24, headPosZ + 10);
    group.add(spoutLeft);

    const spoutRightGeo = new THREE.CylinderGeometry(3.5, 2, 16, 12);
    const spoutRight = new THREE.Mesh(spoutRightGeo, chromeMat);
    spoutRight.rotation.z = 0.15;
    spoutRight.position.set(8, groupHeadY - 24, headPosZ + 10);
    group.add(spoutRight);

    // Portafilter Handle (Ergonomic handle angled forward-right)
    const handleLen = 85;
    const handleGeo = new THREE.CylinderGeometry(8, 10, handleLen, 16);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.rotation.x = Math.PI / 2;
    handle.rotation.y = -0.3; // slightly angled to the right for natural barista grip
    handle.position.set(16, groupHeadY - 8, headPosZ + 10 + handleLen / 2 + 16);
    group.add(handle);

    // Chrome butt cap on handle
    const capGeo = new THREE.SphereGeometry(9, 16, 16);
    const cap = new THREE.Mesh(capGeo, chromeMat);
    cap.position.set(16 + Math.sin(0.3) * handleLen, groupHeadY - 8, headPosZ + 10 + handleLen + 16);
    group.add(cap);

    // 5. Steam Wand (Lanceta / Tubo de vapor orientable)
    const wandPivotX = -w / 2 + 22;
    const wandPivotY = h - headH + 8;
    const wandPivotZ = headPosZ + 8;

    const wandBall = new THREE.Mesh(new THREE.SphereGeometry(8, 16, 16), chromeMat);
    wandBall.position.set(wandPivotX, wandPivotY, wandPivotZ);
    group.add(wandBall);

    const wandUpperGeo = new THREE.CylinderGeometry(4, 4, 35, 12);
    const wandUpper = new THREE.Mesh(wandUpperGeo, chromeMat);
    wandUpper.rotation.z = 0.25;
    wandUpper.position.set(wandPivotX - 5, wandPivotY - 16, wandPivotZ);
    group.add(wandUpper);

    // Rubber heat grip on steam wand
    const gripGeo = new THREE.CylinderGeometry(5.5, 5.5, 18, 12);
    const grip = new THREE.Mesh(gripGeo, accentMat);
    grip.rotation.z = 0.25;
    grip.position.set(wandPivotX - 5, wandPivotY - 16, wandPivotZ);
    group.add(grip);

    // Wand lower pipe and nozzle tip
    const wandLowerGeo = new THREE.CylinderGeometry(3.5, 2.5, 42, 12);
    const wandLower = new THREE.Mesh(wandLowerGeo, chromeMat);
    wandLower.rotation.x = 0.2;
    wandLower.position.set(wandPivotX - 10, wandPivotY - 44, wandPivotZ + 8);
    group.add(wandLower);

    // 6. Top Cup Warming Surface & Perimeter Chrome Guard Rail
    const railMat = chromeMat;
    const topY = h;
    const railH = 14;

    // Warming plate surface
    const plateGeo = new THREE.BoxGeometry(w * 0.9, 3, d * 0.75);
    const plate = new THREE.Mesh(plateGeo, chromeMat);
    plate.position.set(0, topY + 1.5, -d * 0.05);
    group.add(plate);

    // Rear Rail
    const railRearGeo = new THREE.CylinderGeometry(2.5, 2.5, w * 0.88, 12);
    const railRear = new THREE.Mesh(railRearGeo, railMat);
    railRear.rotation.z = Math.PI / 2;
    railRear.position.set(0, topY + railH, -d / 2 + 20);
    group.add(railRear);

    // Left & Right Rails
    const railSideGeo = new THREE.CylinderGeometry(2.5, 2.5, d * 0.65, 12);
    const railLeft = new THREE.Mesh(railSideGeo, railMat);
    railLeft.rotation.x = Math.PI / 2;
    railLeft.position.set(-w / 2 + 15, topY + railH, -d * 0.05);
    group.add(railLeft);

    const railRight = new THREE.Mesh(railSideGeo, railMat);
    railRight.rotation.x = Math.PI / 2;
    railRight.position.set(w / 2 - 15, topY + railH, -d * 0.05);
    group.add(railRight);

    // 7. Ceramic Espresso Cups on Drip Tray (under spouts)
    const cupMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15 });
    const cupOffsets = [{ x: -14 }, { x: 14 }];
    for (const co of cupOffsets) {
      // Cup body
      const cupGeo = new THREE.CylinderGeometry(14, 10, 24, 20);
      const cup = new THREE.Mesh(cupGeo, cupMat);
      cup.position.set(co.x, footH + dripTrayH + 16, headPosZ + 10);
      group.add(cup);

      // Cup handle
      const cupHandleGeo = new THREE.TorusGeometry(6, 1.8, 8, 16, Math.PI);
      const cupHandle = new THREE.Mesh(cupHandleGeo, cupMat);
      cupHandle.rotation.y = co.x > 0 ? 0 : Math.PI;
      cupHandle.position.set(co.x + (co.x > 0 ? 13 : -13), footH + dripTrayH + 16, headPosZ + 10);
      group.add(cupHandle);
    }

    // 8. Rear Water Reservoir (Depósito acrílico ahumado)
    const tankH = mainBodyH * 0.75;
    const tankD = rearBodyD * 0.35;
    const tankW = w * 0.78;
    const tankGeo = new THREE.BoxGeometry(tankW, tankH, tankD);
    const tank = new THREE.Mesh(tankGeo, darkGlassMat);
    tank.position.set(0, bodyBaseY + tankH / 2 + 20, - (d / 2) + tankD / 2 + 6);
    group.add(tank);
  }

  // --- 8. ACCESORIOS DE MOBILIARIO: PATAS DE MESA Y MUEBLES ---

  private buildTableLeg(
    group: THREE.Group,
    appliance: ApplianceItem,
    w: number,
    h: number,
    d: number,
    bodyMat: THREE.Material,
    accentMat: THREE.Material,
    chromeMat: THREE.Material
  ) {
    const style = this.determineLegStyle(appliance);
    this.buildSingleLeg(group, style, w, h, d, bodyMat, accentMat, chromeMat);
  }

  private buildTableLegsSet(
    group: THREE.Group,
    appliance: ApplianceItem,
    w: number,
    h: number,
    d: number,
    bodyMat: THREE.Material,
    accentMat: THREE.Material,
    chromeMat: THREE.Material
  ) {
    const style = this.determineLegStyle(appliance);
    // Inset from outer boundary edges
    const insetX = Math.min(50, w * 0.12);
    const insetZ = Math.min(50, d * 0.12);

    const halfW = w / 2 - insetX;
    const halfZ = d / 2 - insetZ;

    // 4 Symmetrical outer corners:
    // splayX and splayZ point directly outward to the exterior corners:
    // Front-Left:  X negative, Z positive
    // Front-Right: X positive, Z positive
    // Rear-Left:   X negative, Z negative
    // Rear-Right:  X positive, Z negative
    const corners = [
      { x: -halfW, z: halfZ, splayX: -1, splayZ: 1 },   // Front-Left
      { x: halfW, z: halfZ, splayX: 1, splayZ: 1 },     // Front-Right
      { x: -halfW, z: -halfZ, splayX: -1, splayZ: -1 }, // Rear-Left
      { x: halfW, z: -halfZ, splayX: 1, splayZ: -1 },   // Rear-Right
    ];

    for (const c of corners) {
      const legSubGroup = new THREE.Group();
      legSubGroup.position.set(c.x, 0, c.z);
      this.buildSingleLeg(
        legSubGroup,
        style,
        120, // localized footprint width
        h,
        120, // localized footprint depth
        bodyMat,
        accentMat,
        chromeMat,
        c.splayX,
        c.splayZ
      );
      group.add(legSubGroup);
    }
  }

  private determineLegStyle(appliance: ApplianceItem): 'hairpin' | 'cylindrical_inox' | 'scandinavian_wood' {
    const text = `${appliance.id} ${appliance.name} ${appliance.modelCode || ''} ${appliance.notes || ''}`.toLowerCase();
    if (text.includes('hairpin') || text.includes('horquilla') || text.includes('varilla')) {
      return 'hairpin';
    }
    if (text.includes('cylind') || text.includes('cilind') || text.includes('inox') || text.includes('tubular')) {
      return 'cylindrical_inox';
    }
    if (text.includes('scand') || text.includes('nordic') || text.includes('wood') || text.includes('madera') || text.includes('conic')) {
      return 'scandinavian_wood';
    }
    // Default by finish if applicable
    if (appliance.finish === 'natural_wood') return 'scandinavian_wood';
    if (appliance.finish === 'stainless_steel') return 'cylindrical_inox';
    return 'hairpin';
  }

  private buildSingleLeg(
    targetGroup: THREE.Group,
    style: 'hairpin' | 'cylindrical_inox' | 'scandinavian_wood',
    w: number,
    h: number,
    d: number,
    bodyMat: THREE.Material,
    accentMat: THREE.Material,
    chromeMat: THREE.Material,
    splayX = 0,
    splayZ = 0
  ) {
    switch (style) {
      case 'hairpin':
        this.buildHairpinMesh(targetGroup, h, bodyMat, accentMat, splayX, splayZ);
        break;
      case 'cylindrical_inox':
        this.buildCylindricalMesh(targetGroup, h, chromeMat, accentMat);
        break;
      case 'scandinavian_wood':
        this.buildScandinavianMesh(targetGroup, h, bodyMat, accentMat, splayX, splayZ);
        break;
    }
  }

  // A) Pata Horquilla / Hairpin Metal (Triple varilla con inclinación estética y pletina en escuadra)
  private buildHairpinMesh(
    group: THREE.Group,
    h: number,
    steelMat: THREE.Material,
    accentMat: THREE.Material,
    splayX: number,
    splayZ: number
  ) {
    const dirX = splayX !== 0 ? Math.sign(splayX) : 1;
    const dirZ = splayZ !== 0 ? Math.sign(splayZ) : 1;

    const plateSize = 90;
    const plateThick = 4;
    const rodR = 5.5; // Ø11mm solid steel rod

    // Top Mounting Plate (L-shaped bracket along the corner edges)
    const plateGroup = new THREE.Group();
    plateGroup.position.set(0, h - plateThick / 2, 0);

    const plateWing1 = new THREE.Mesh(new THREE.BoxGeometry(plateSize, plateThick, 30), steelMat);
    plateWing1.position.set((dirX * plateSize) / 2 - dirX * 15, 0, 0);
    plateGroup.add(plateWing1);

    const plateWing2 = new THREE.Mesh(new THREE.BoxGeometry(30, plateThick, plateSize), steelMat);
    plateWing2.position.set(0, 0, (dirZ * plateSize) / 2 - dirZ * 15);
    plateGroup.add(plateWing2);

    // Countersunk mounting screw holes
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const holeOffsets = [
      { x: dirX * 25, z: 0 },
      { x: dirX * 65, z: 0 },
      { x: 0, z: dirZ * 25 },
      { x: 0, z: dirZ * 65 }
    ];
    for (const ho of holeOffsets) {
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, plateThick + 0.5, 12), holeMat);
      hole.position.set(ho.x, 0, ho.z);
      plateGroup.add(hole);
    }
    group.add(plateGroup);

    // Hairpin Rods & Bottom Loop:
    // Outward splay angle (~8 degrees) towards exterior corner (dirX, dirZ)
    const splayAngle = 0.14;
    const footSpread = Math.tan(splayAngle) * (h - 20);
    const bottomPos = new THREE.Vector3(dirX * footSpread, 10, dirZ * footSpread);

    // Silicone / Rubber Floor Protector Pad (Regatón antiarañazos)
    const padGeo = new THREE.CylinderGeometry(16, 16, 8, 20);
    const pad = new THREE.Mesh(padGeo, accentMat);
    pad.position.set(bottomPos.x, 4, bottomPos.z);
    group.add(pad);

    // Bottom Hairpin U-Turn / Loop
    const loopGeo = new THREE.TorusGeometry(12, rodR, 12, 24, Math.PI);
    const loop = new THREE.Mesh(loopGeo, steelMat);
    loop.rotation.x = Math.PI / 2;
    const angleRad = Math.atan2(dirZ, dirX);
    loop.rotation.z = angleRad + Math.PI / 2;
    loop.position.set(bottomPos.x, 10, bottomPos.z);
    group.add(loop);

    // 3 Structural heavy-duty steel rods connecting top bracket to bottom loop:
    const topPoints = [
      new THREE.Vector3(dirX * 60, h - plateThick, 0),
      new THREE.Vector3(0, h - plateThick, dirZ * 60),
      new THREE.Vector3(dirX * 25, h - plateThick, dirZ * 25) // central rod
    ];

    const upAxis = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < topPoints.length; i++) {
      const topP = topPoints[i];
      const botP = bottomPos.clone();
      if (i === 0) botP.x += dirX * 6;
      else if (i === 1) botP.z += dirZ * 6;

      const delta = botP.clone().sub(topP);
      const rodLength = delta.length();
      const midPoint = topP.clone().add(botP).multiplyScalar(0.5);

      const rodGeo = new THREE.CylinderGeometry(rodR, rodR, rodLength, 16);
      const rod = new THREE.Mesh(rodGeo, steelMat);
      rod.position.copy(midPoint);
      rod.quaternion.setFromUnitVectors(upAxis, delta.clone().normalize());
      group.add(rod);
    }
  }

  // B) Pata Cilíndrica Inox Regulable Ø60mm (Tubo cepillado + brida superior + regatón roscado)
  private buildCylindricalMesh(
    group: THREE.Group,
    h: number,
    chromeMat: THREE.Material,
    accentMat: THREE.Material
  ) {
    const tubeR = 30; // Ø60mm tube
    const plateSize = 90;
    const plateThick = 4;
    const levelerH = 26;
    const tubeH = h - plateThick - levelerH;

    // 1. Top Mounting Flange Plate
    const topPlateGeo = new THREE.BoxGeometry(plateSize, plateThick, plateSize);
    const topPlate = new THREE.Mesh(topPlateGeo, chromeMat);
    topPlate.position.set(0, h - plateThick / 2, 0);
    group.add(topPlate);

    // 4 Fixing screw holes on plate
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const holeD = plateSize / 2 - 14;
    const holes = [
      { x: -holeD, z: -holeD },
      { x: holeD, z: -holeD },
      { x: -holeD, z: holeD },
      { x: holeD, z: holeD }
    ];
    for (const ho of holes) {
      const hMesh = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, plateThick + 0.5, 12), holeMat);
      hMesh.position.set(ho.x, h - plateThick / 2, ho.z);
      group.add(hMesh);
    }

    // 2. Main Stainless Steel Column Tube
    const tubeGeo = new THREE.CylinderGeometry(tubeR, tubeR, tubeH, 32);
    const tube = new THREE.Mesh(tubeGeo, chromeMat);
    tube.position.set(0, levelerH + tubeH / 2, 0);
    group.add(tube);

    // Decorative polished collar at base of tube
    const collarGeo = new THREE.CylinderGeometry(tubeR + 2, tubeR + 2, 10, 32);
    const collar = new THREE.Mesh(collarGeo, chromeMat);
    collar.position.set(0, levelerH + 5, 0);
    group.add(collar);

    // 3. Adjustable Threaded Leveler Foot (Regatón roscado regulable)
    const threadGeo = new THREE.CylinderGeometry(12, 12, levelerH, 20);
    const thread = new THREE.Mesh(threadGeo, chromeMat);
    thread.position.set(0, levelerH / 2, 0);
    group.add(thread);

    const footBaseGeo = new THREE.CylinderGeometry(tubeR - 2, tubeR + 1, 14, 32);
    const footBase = new THREE.Mesh(footBaseGeo, accentMat);
    footBase.position.set(0, 7, 0);
    group.add(footBase);
  }

  // C) Pata Cónica Madera Nórdica Escandinava (Cono torneado + placa horizontal de fijación + regatón dorado)
  private buildScandinavianMesh(
    group: THREE.Group,
    h: number,
    woodMat: THREE.Material,
    goldMat: THREE.Material,
    splayX: number,
    splayZ: number
  ) {
    const topR = 24;   // Ø48mm at top
    const botR = 13;   // Ø26mm at bottom (elegante conicidad)
    const plateSize = 76;
    const plateThick = 4.5;

    // 1. Top Mounting Plate (Placa metálica horizontal de fijación enrasada a la cota h)
    const plateGeo = new THREE.BoxGeometry(plateSize, plateThick, plateSize);
    const plate = new THREE.Mesh(plateGeo, goldMat);
    plate.position.set(0, h - plateThick / 2, 0);
    group.add(plate);

    // Decorative mounting screw heads
    const screwMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const screwOffset = plateSize / 2 - 12;
    for (const sx of [-screwOffset, screwOffset]) {
      for (const sz of [-screwOffset, screwOffset]) {
        const screw = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, plateThick + 0.4, 12), screwMat);
        screw.position.set(sx, h - plateThick / 2, sz);
        group.add(screw);
      }
    }

    // 2. Pivote de inclinación situado exactamente en la cara inferior de la pletina de montaje
    const pivotY = h - plateThick;
    const legContainer = new THREE.Group();
    legContainer.position.set(0, pivotY, 0);

    const hasSplay = splayX !== 0 || splayZ !== 0;
    const splayAngle = hasSplay ? 0.14 : 0; // Inclinación simétrica de ~8 grados
    // Longitud axial de la pata para que alcance exactamente y = 0 en el suelo
    const totalLegLen = pivotY / Math.cos(splayAngle);
    const ferruleH = Math.min(52, totalLegLen * 0.12);
    const feltH = 4;
    const woodH = totalLegLen - ferruleH - feltH;

    // Cono de madera maciza (se extiende hacia abajo a lo largo del eje local -Y)
    const legGeo = new THREE.CylinderGeometry(topR, botR * 1.05, woodH, 32);
    const legMesh = new THREE.Mesh(legGeo, woodMat);
    legMesh.position.set(0, -woodH / 2, 0);
    legContainer.add(legMesh);

    // Casquillo dorado decorativo inferior (Ferrule)
    const ferruleGeo = new THREE.CylinderGeometry(botR * 1.05, botR, ferruleH, 32);
    const ferrule = new THREE.Mesh(ferruleGeo, goldMat);
    ferrule.position.set(0, -woodH - ferruleH / 2, 0);
    legContainer.add(ferrule);

    // Regatón protector de suelo en fieltro negro
    const feltMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 });
    const feltGeo = new THREE.CylinderGeometry(botR * 0.92, botR * 0.92, feltH, 24);
    const felt = new THREE.Mesh(feltGeo, feltMat);
    felt.position.set(0, -woodH - ferruleH - feltH / 2, 0);
    legContainer.add(felt);

    // Inclinación cónica simétrica hacia la diagonal exterior de cada esquina
    if (hasSplay) {
      const len = Math.hypot(splayX, splayZ);
      const ux = splayX / len;
      const uz = splayZ / len;
      // Eje de rotación en el plano XZ perpendicular a la dirección exterior (ux, uz):
      // (-uz, 0, ux) rota el vector (0, -1, 0) hacia la dirección (ux, -cos(theta), uz)
      const rotAxis = new THREE.Vector3(-uz, 0, ux).normalize();
      legContainer.setRotationFromAxisAngle(rotAxis, splayAngle);
    }

    group.add(legContainer);
  }

  // --- 9. INTERIORISMO: TABURETES DE BARRA, SILLAS, MESAS, LÁMPARAS, VENTANAS Y PUERTAS ---

  private buildBarStool(
    group: THREE.Group,
    w: number,
    h: number,
    d: number,
    bodyMat: THREE.Material,
    accentMat: THREE.Material,
    chromeMat: THREE.Material
  ) {
    const seatHeight = Math.round(h * 0.78);
    const backHeight = h - seatHeight;
    const cushionMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.75,
      metalness: 0.05
    });

    // 4 Patas inclinadas desde la base del asiento hasta el suelo
    const topSpreadX = w * 0.28;
    const topSpreadZ = d * 0.28;
    const botSpreadX = w * 0.42;
    const botSpreadZ = d * 0.42;
    const upAxis = new THREE.Vector3(0, 1, 0);

    const legCoords = [
      { tx: -topSpreadX, tz: topSpreadZ, bx: -botSpreadX, bz: botSpreadZ },
      { tx: topSpreadX, tz: topSpreadZ, bx: botSpreadX, bz: botSpreadZ },
      { tx: -topSpreadX, tz: -topSpreadZ, bx: -botSpreadX, bz: -botSpreadZ },
      { tx: topSpreadX, tz: -topSpreadZ, bx: botSpreadX, bz: -botSpreadZ }
    ];

    for (const lc of legCoords) {
      const topV = new THREE.Vector3(lc.tx, seatHeight - 15, lc.tz);
      const botV = new THREE.Vector3(lc.bx, 0, lc.bz);
      const delta = botV.clone().sub(topV);
      const len = delta.length();
      const mid = topV.clone().add(botV).multiplyScalar(0.5);

      const legGeo = new THREE.CylinderGeometry(14, 10, len, 16);
      const leg = new THREE.Mesh(legGeo, bodyMat);
      leg.position.copy(mid);
      leg.quaternion.setFromUnitVectors(upAxis, delta.clone().normalize());
      group.add(leg);
    }

    // Aro reposapiés perimetral a ~280mm del suelo
    const footrestY = Math.round(seatHeight * 0.36);
    const ringRadius = Math.min(w, d) * 0.37;
    const ringGeo = new THREE.TorusGeometry(ringRadius, 6, 12, 32);
    const ring = new THREE.Mesh(ringGeo, chromeMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, footrestY, 0);
    group.add(ring);

    // Base del asiento y cojín ergonómico
    const seatBaseGeo = new THREE.CylinderGeometry(w * 0.42, w * 0.38, 26, 28);
    const seatBase = new THREE.Mesh(seatBaseGeo, bodyMat);
    seatBase.position.set(0, seatHeight - 13, 0);
    group.add(seatBase);

    const padGeo = new THREE.CylinderGeometry(w * 0.40, w * 0.41, 22, 28);
    const pad = new THREE.Mesh(padGeo, cushionMat);
    pad.position.set(0, seatHeight + 8, 0);
    group.add(pad);

    // Respaldo bajo curvado
    if (backHeight > 40) {
      const backGeo = new THREE.BoxGeometry(w * 0.76, backHeight * 0.72, 24);
      const back = new THREE.Mesh(backGeo, cushionMat);
      back.position.set(0, seatHeight + backHeight * 0.55, -d * 0.36);
      back.rotation.x = -0.12;
      group.add(back);

      // Soportes traseros del respaldo
      for (const sx of [-w * 0.2, w * 0.2]) {
        const postGeo = new THREE.BoxGeometry(16, backHeight * 0.6, 12);
        const post = new THREE.Mesh(postGeo, accentMat);
        post.position.set(sx, seatHeight + backHeight * 0.28, -d * 0.35);
        post.rotation.x = -0.1;
        group.add(post);
      }
    }
  }

  private buildDiningChair(
    group: THREE.Group,
    w: number,
    h: number,
    d: number,
    bodyMat: THREE.Material,
    accentMat: THREE.Material,
    chromeMat: THREE.Material
  ) {
    const seatH = Math.round(h * 0.54);
    const backH = h - seatH;
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.45,
      metalness: 0.05
    });
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.8
    });

    // 4 Patas cónicas nórdicas
    const upAxis = new THREE.Vector3(0, 1, 0);
    const corners = [
      { tx: -w * 0.3, tz: d * 0.28, bx: -w * 0.42, bz: d * 0.4 },
      { tx: w * 0.3, tz: d * 0.28, bx: w * 0.42, bz: d * 0.4 },
      { tx: -w * 0.3, tz: -d * 0.28, bx: -w * 0.42, bz: -d * 0.42 },
      { tx: w * 0.3, tz: -d * 0.28, bx: w * 0.42, bz: -d * 0.42 }
    ];
    for (const c of corners) {
      const topV = new THREE.Vector3(c.tx, seatH - 12, c.tz);
      const botV = new THREE.Vector3(c.bx, 0, c.bz);
      const delta = botV.clone().sub(topV);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(14, 9, delta.length(), 16), bodyMat);
      leg.position.copy(topV.clone().add(botV).multiplyScalar(0.5));
      leg.quaternion.setFromUnitVectors(upAxis, delta.clone().normalize());
      group.add(leg);
    }

    // Tensores metálicos tipo Eames
    const crossGeo = new THREE.BoxGeometry(w * 0.62, 5, d * 0.58);
    const cross = new THREE.Mesh(crossGeo, chromeMat);
    cross.position.set(0, seatH * 0.68, 0);
    group.add(cross);

    // Asiento y respaldo envolvente
    const seatMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, 22, d * 0.84), shellMat);
    seatMesh.position.set(0, seatH, 10);
    group.add(seatMesh);

    const cushionMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 14, d * 0.74), padMat);
    cushionMesh.position.set(0, seatH + 14, 12);
    group.add(cushionMesh);

    const backMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.84, backH * 0.92, 22), shellMat);
    backMesh.position.set(0, seatH + backH * 0.46, -d * 0.36);
    backMesh.rotation.x = -0.14;
    group.add(backMesh);
  }

  private buildDiningTable(
    group: THREE.Group,
    w: number,
    h: number,
    d: number,
    bodyMat: THREE.Material,
    accentMat: THREE.Material
  ) {
    const topThick = 34;
    const apronH = 55;
    const legH = h - topThick;

    // Tablero principal de la mesa
    const topGeo = new THREE.BoxGeometry(w, topThick, d);
    const topMesh = new THREE.Mesh(topGeo, bodyMat);
    topMesh.position.set(0, h - topThick / 2, 0);
    group.add(topMesh);

    // Bastidor inferior (faldón remetido)
    const apronW = w - 180;
    const apronD = d - 160;
    const apronGeo = new THREE.BoxGeometry(apronW, apronH, apronD);
    const apron = new THREE.Mesh(apronGeo, accentMat);
    apron.position.set(0, h - topThick - apronH / 2, 0);
    group.add(apron);

    // 4 Patas arquitectónicas
    const legSection = 55;
    const legPositions = [
      { x: -w / 2 + 75, z: d / 2 - 75 },
      { x: w / 2 - 75, z: d / 2 - 75 },
      { x: -w / 2 + 75, z: -d / 2 + 75 },
      { x: w / 2 - 75, z: -d / 2 + 75 }
    ];
    for (const lp of legPositions) {
      const legGeo = new THREE.BoxGeometry(legSection, legH, legSection);
      const leg = new THREE.Mesh(legGeo, bodyMat);
      leg.position.set(lp.x, legH / 2, lp.z);
      group.add(leg);
    }
  }

  private buildPendantLamp(
    group: THREE.Group,
    appliance: ApplianceItem,
    w: number,
    h: number,
    d: number,
    bodyMat: THREE.Material,
    accentMat: THREE.Material,
    chromeMat: THREE.Material
  ) {
    const isTrio = w >= 600 || appliance.id.includes('trio') || appliance.name.toLowerCase().includes('triple');
    const warmBulbMat = new THREE.MeshStandardMaterial({
      color: 0xfff7ed,
      emissive: 0xffd27d,
      emissiveIntensity: 1.6,
      roughness: 0.2
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.88,
      roughness: 0.24
    });

    if (isTrio) {
      // Florón rectangular de techo
      const canopyH = 26;
      const canopyGeo = new THREE.BoxGeometry(w * 0.82, canopyH, Math.min(110, d * 0.55));
      const canopy = new THREE.Mesh(canopyGeo, bodyMat);
      canopy.position.set(0, h - canopyH / 2, 0);
      group.add(canopy);

      const shadeH = Math.min(220, h * 0.32);
      const shadeR = Math.min(95, d * 0.42);
      const cordLen = Math.max(120, h - canopyH - shadeH);
      const offsetsX = [-w * 0.32, 0, w * 0.32];

      for (const ox of offsetsX) {
        // Cable tensor
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, cordLen, 10), accentMat);
        cord.position.set(ox, h - canopyH - cordLen / 2, 0);
        group.add(cord);

        // Casquillo superior de latón
        const socket = new THREE.Mesh(new THREE.CylinderGeometry(16, 20, 36, 16), brassMat);
        socket.position.set(ox, shadeH + 16, 0);
        group.add(socket);

        // Pantalla cónica/cilíndrica
        const shade = new THREE.Mesh(new THREE.CylinderGeometry(shadeR * 0.65, shadeR, shadeH, 28), bodyMat);
        shade.position.set(ox, shadeH / 2, 0);
        group.add(shade);

        // Difusor emisivo inferior
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(shadeR * 0.42, 16, 16), warmBulbMat);
        bulb.position.set(ox, 18, 0);
        group.add(bulb);
      }
    } else {
      // Lámpara domo individual
      const canopyH = 28;
      const canopy = new THREE.Mesh(new THREE.CylinderGeometry(65, 65, canopyH, 24), bodyMat);
      canopy.position.set(0, h - canopyH / 2, 0);
      group.add(canopy);

      const domeR = Math.min(w, d) * 0.48;
      const cordLen = Math.max(120, h - canopyH - domeR);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, cordLen, 10), accentMat);
      cord.position.set(0, h - canopyH - cordLen / 2, 0);
      group.add(cord);

      const socket = new THREE.Mesh(new THREE.CylinderGeometry(18, 24, 42, 18), brassMat);
      socket.position.set(0, domeR + 18, 0);
      group.add(socket);

      const domeGeo = new THREE.SphereGeometry(domeR, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.52);
      const dome = new THREE.Mesh(domeGeo, bodyMat);
      dome.position.set(0, 10, 0);
      group.add(dome);

      const diffuser = new THREE.Mesh(new THREE.CircleGeometry(domeR * 0.92, 28), warmBulbMat);
      diffuser.rotation.x = Math.PI / 2;
      diffuser.position.set(0, 12, 0);
      group.add(diffuser);
    }

    // Luz 3D real cálida hacia el mesón/isla
    const light = new THREE.PointLight(0xffdfa0, 0.85, 2600, 1.5);
    light.position.set(0, -15, 0);
    group.add(light);
  }

  private buildWindowFrame(
    group: THREE.Group,
    w: number,
    h: number,
    d: number,
    frameMat: THREE.Material,
    chromeMat: THREE.Material
  ) {
    const frameThick = 45;
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0xbae6fd,
      emissiveIntensity: 0.22,
      roughness: 0.08,
      metalness: 0.15,
      transparent: true,
      opacity: 0.52
    });

    // Marco perimetral exterior
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(w, frameThick, d), frameMat);
    topBar.position.set(0, h - frameThick / 2, 0);
    group.add(topBar);

    const botSill = new THREE.Mesh(new THREE.BoxGeometry(w + 40, frameThick, d + 35), frameMat);
    botSill.position.set(0, frameThick / 2, 12);
    group.add(botSill);

    const leftPost = new THREE.Mesh(new THREE.BoxGeometry(frameThick, h - frameThick * 2, d), frameMat);
    leftPost.position.set(-w / 2 + frameThick / 2, h / 2, 0);
    group.add(leftPost);

    const rightPost = new THREE.Mesh(new THREE.BoxGeometry(frameThick, h - frameThick * 2, d), frameMat);
    rightPost.position.set(w / 2 - frameThick / 2, h / 2, 0);
    group.add(rightPost);

    // Parteluz vertical central
    const centerMullion = new THREE.Mesh(new THREE.BoxGeometry(frameThick * 0.75, h - frameThick * 2, d * 0.75), frameMat);
    centerMullion.position.set(0, h / 2, 0);
    group.add(centerMullion);

    // Paneles de cristal translúcido luminoso
    const paneW = (w - frameThick * 2.75) / 2;
    const paneH = h - frameThick * 2;
    for (const px of [-paneW / 2 - frameThick * 0.38, paneW / 2 + frameThick * 0.38]) {
      const glass = new THREE.Mesh(new THREE.BoxGeometry(paneW, paneH, 10), glassMat);
      glass.position.set(px, h / 2, 0);
      group.add(glass);
    }

    // Manilla central de cierre
    const handle = new THREE.Mesh(new THREE.BoxGeometry(14, 65, 22), chromeMat);
    handle.position.set(12, h * 0.45, d * 0.38);
    group.add(handle);
  }

  private buildDoorFrame(
    group: THREE.Group,
    w: number,
    h: number,
    d: number,
    bodyMat: THREE.Material,
    accentMat: THREE.Material,
    chromeMat: THREE.Material
  ) {
    const jambW = 55;
    // Marco superior e izquierdo/derecho
    const header = new THREE.Mesh(new THREE.BoxGeometry(w, jambW, d), accentMat);
    header.position.set(0, h - jambW / 2, 0);
    group.add(header);

    const leftJamb = new THREE.Mesh(new THREE.BoxGeometry(jambW, h - jambW, d), accentMat);
    leftJamb.position.set(-w / 2 + jambW / 2, (h - jambW) / 2, 0);
    group.add(leftJamb);

    const rightJamb = new THREE.Mesh(new THREE.BoxGeometry(jambW, h - jambW, d), accentMat);
    rightJamb.position.set(w / 2 - jambW / 2, (h - jambW) / 2, 0);
    group.add(rightJamb);

    // Hoja de la puerta con entablerado arquitectónico
    const leafW = w - jambW * 2 - 6;
    const leafH = h - jambW - 8;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(leafW, leafH, 44), bodyMat);
    leaf.position.set(0, leafH / 2 + 4, 0);
    group.add(leaf);

    // Manija de roseta en acero inoxidable
    const handleY = Math.min(1020, h * 0.48);
    const handleX = leafW / 2 - 65;
    const rosette = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 56, 20), chromeMat);
    rosette.rotation.x = Math.PI / 2;
    rosette.position.set(handleX, handleY, 0);
    group.add(rosette);

    const leverF = new THREE.Mesh(new THREE.BoxGeometry(115, 16, 18), chromeMat);
    leverF.position.set(handleX - 45, handleY, 38);
    group.add(leverF);

    const leverB = new THREE.Mesh(new THREE.BoxGeometry(115, 16, 18), chromeMat);
    leverB.position.set(handleX - 45, handleY, -38);
    group.add(leverB);
  }
}

