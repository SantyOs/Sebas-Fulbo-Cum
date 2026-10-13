"""Prepare only redistributable assets used by the game from the two Standard ZIPs.
Usage: python scripts/prepare-assets.py <base-characters.zip> <animation-library.zip>
No network, Blender, paid pack, or runtime asset service is required.
"""
import hashlib
import json
import struct
import sys
import zipfile
from pathlib import Path

OUTPUT = Path(__file__).resolve().parents[1] / 'src/client/public/assets/players'


def glb(document, binary):
    document['buffers'] = [{'byteLength': len(binary)}]
    encoded = json.dumps(document, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    binary += b'\0' * (-len(binary) % 4)
    return (struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(binary))
            + struct.pack('<II', len(encoded), 0x4E4F534A) + encoded
            + struct.pack('<II', len(binary), 0x004E4942) + binary)


def main(base_zip, animations_zip):
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(base_zip) as archive:
        name = next(n for n in archive.namelist() if n.endswith('Superhero_Male_FullBody.gltf'))
        model = json.loads(archive.read(name))
        folder = name.rsplit('/', 1)[0]
        binary = archive.read(folder + '/' + model['buffers'][0]['uri'])
        # Skin, kit and hair colors are authored per player; no unused 4K textures.
        model.pop('images', None)
        model.pop('textures', None)
        model.pop('samplers', None)
        for material in model['materials']:
            material.pop('normalTexture', None)
            material.pop('occlusionTexture', None)
            material['pbrMetallicRoughness'] = {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0, 'roughnessFactor': 0.85}
        (OUTPUT / 'footballer.glb').write_bytes(glb(model, binary))
        (OUTPUT / 'characters-LICENSE.txt').write_bytes(archive.read(next(n for n in archive.namelist() if 'License' in n)))
    with zipfile.ZipFile(animations_zip) as archive:
        name = next(n for n in archive.namelist() if n.endswith('/UAL1_Standard.glb'))
        raw = archive.read(name)
        json_length = struct.unpack_from('<I', raw, 12)[0]
        document = json.loads(raw[20:20 + json_length])
        binary = raw[28 + json_length:]
        names = {'Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Crouch_Fwd_Loop'}
        document['animations'] = [a for a in document['animations'] if a['name'] in names]
        for node in document['nodes']:
            node.pop('mesh', None)
            node.pop('skin', None)
        for key in ['meshes', 'skins', 'materials']:
            document.pop(key, None)
        # Compact accessors and bufferViews to discard unused models and clips.
        used = sorted({s[k] for a in document['animations'] for s in a['samplers'] for k in ('input', 'output')})
        accessors = [document['accessors'][i] for i in used]
        used_views = sorted({a['bufferView'] for a in accessors})
        packed = bytearray()
        views = []
        for old in used_views:
            view = dict(document['bufferViews'][old])
            start = view.get('byteOffset', 0)
            packed += b'\0' * (-len(packed) % 4)
            view['byteOffset'] = len(packed)
            view['buffer'] = 0
            packed += binary[start:start + view['byteLength']]
            views.append(view)
        for accessor in accessors:
            accessor['bufferView'] = used_views.index(accessor['bufferView'])
        for animation in document['animations']:
            for sampler in animation['samplers']:
                for key in ('input', 'output'):
                    sampler[key] = used.index(sampler[key])
        document['accessors'] = accessors
        document['bufferViews'] = views
        (OUTPUT / 'locomotion.glb').write_bytes(glb(document, bytes(packed)))
        (OUTPUT / 'animations-LICENSE.txt').write_bytes(archive.read(next(n for n in archive.namelist() if n.endswith('License.txt'))))
    manifest = {
        'sources': {
            'characters': 'https://quaternius.itch.io/universal-base-characters',
            'animations': 'https://quaternius.itch.io/universal-animation-library',
        },
        'edition': 'Standard (free)',
        'license': 'CC0-1.0',
        'files': {p.name: {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
                  for p in sorted(OUTPUT.iterdir()) if p.suffix in ('.glb', '.txt')},
    }
    (OUTPUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print('Prepared footballer.glb, locomotion.glb, licenses and manifest.')


if __name__ == '__main__':
    main(*sys.argv[1:])
