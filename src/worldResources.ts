import * as THREE from "three";

/** Counts shared ownership, including textures; detached runtime objects remain owned. */
export class WorldResources {
  private nodes = new Set<THREE.Object3D>();
  private geometries = new Map<THREE.BufferGeometry, number>();
  private materials = new Map<THREE.Material, number>();
  private textures = new Map<THREE.Texture, number>();
  private materialTextures = new Map<THREE.Material, Set<THREE.Texture>>();
  private lights = new Set<THREE.Light>();
  private instances = new Set<THREE.InstancedMesh>();

  track(root: THREE.Object3D): void {
    root.traverse((node) => {
      if (this.nodes.has(node)) return;
      this.nodes.add(node);
      if (node instanceof THREE.InstancedMesh) this.instances.add(node);
      const drawable = node as THREE.Mesh;
      if (drawable.geometry)
        this.geometries.set(
          drawable.geometry,
          (this.geometries.get(drawable.geometry) ?? 0) + 1,
        );
      if (drawable.material) {
        for (const material of Array.isArray(drawable.material)
          ? drawable.material
          : [drawable.material]) {
          if (!this.materials.has(material)) {
            const textures = new Set<THREE.Texture>();
            for (const value of Object.values(material))
              if (value instanceof THREE.Texture) textures.add(value);
            if (material instanceof THREE.ShaderMaterial) {
              for (const uniform of Object.values(material.uniforms)) {
                const values: unknown[] = Array.isArray(uniform.value)
                  ? uniform.value
                  : [uniform.value];
                for (const value of values)
                  if (value instanceof THREE.Texture) textures.add(value);
              }
            }
            this.materialTextures.set(material, textures);
            textures.forEach((texture) =>
              this.textures.set(texture, (this.textures.get(texture) ?? 0) + 1),
            );
          }
          this.materials.set(material, (this.materials.get(material) ?? 0) + 1);
        }
      }
      if (node instanceof THREE.Light) this.lights.add(node);
    });
  }

  release(root: THREE.Object3D): void {
    root.traverse((node) => {
      if (!this.nodes.delete(node)) return;
      if (node instanceof THREE.InstancedMesh && this.instances.delete(node))
        node.dispose();
      const drawable = node as THREE.Mesh;
      if (drawable.geometry) {
        const count = (this.geometries.get(drawable.geometry) ?? 1) - 1;
        if (count > 0) this.geometries.set(drawable.geometry, count);
        else {
          drawable.geometry.dispose();
          this.geometries.delete(drawable.geometry);
        }
      }
      if (drawable.material) {
        for (const material of Array.isArray(drawable.material)
          ? drawable.material
          : [drawable.material]) {
          const count = (this.materials.get(material) ?? 1) - 1;
          if (count > 0) {
            this.materials.set(material, count);
            continue;
          }
          this.materialTextures.get(material)?.forEach((texture) => {
            const textureCount = (this.textures.get(texture) ?? 1) - 1;
            if (textureCount > 0) this.textures.set(texture, textureCount);
            else {
              texture.dispose();
              this.textures.delete(texture);
            }
          });
          material.dispose();
          this.materials.delete(material);
          this.materialTextures.delete(material);
        }
      }
      if (node instanceof THREE.Light && this.lights.delete(node))
        node.dispose();
    });
  }

  dispose(): void {
    this.instances.forEach((mesh) => mesh.dispose());
    this.instances.clear();
    this.geometries.forEach((_, geometry) => geometry.dispose());
    this.materials.forEach((_, material) => material.dispose());
    this.textures.forEach((_, texture) => texture.dispose());
    this.lights.forEach((light) => light.dispose());
    this.geometries.clear();
    this.materials.clear();
    this.textures.clear();
    this.materialTextures.clear();
    this.lights.clear();
    this.nodes.clear();
  }
}
