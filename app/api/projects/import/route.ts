import { NextRequest, NextResponse } from 'next/server';
import {
  importFromLocal,
  importFromGit,
  createProjectFromImport,
  getBranches,
  detectProjectType,
} from '@/lib/project-import';
import { logSystem } from '@/lib/logging';
import * as path from 'path';
import * as os from 'os';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.type) {
      return NextResponse.json(
        { error: 'Import type is required (local or git)' },
        { status: 400 }
      );
    }

    let projectInfo;

    if (body.type === 'local') {
      if (!body.path) {
        return NextResponse.json(
          { error: 'Path is required for local import' },
          { status: 400 }
        );
      }

      projectInfo = await importFromLocal(body.path);
    } else if (body.type === 'git') {
      if (!body.gitUrl) {
        return NextResponse.json(
          { error: 'Git URL is required for git import' },
          { status: 400 }
        );
      }

      // Clone to a projects directory
      const projectsDir = body.targetPath || path.join(os.homedir(), 'ralphblast-projects');
      projectInfo = await importFromGit(body.gitUrl, projectsDir, body.branch);
    } else {
      return NextResponse.json(
        { error: 'Invalid import type' },
        { status: 400 }
      );
    }

    // If preview mode, just return the project info
    if (body.preview) {
      return NextResponse.json({ preview: true, projectInfo });
    }

    // Create the project
    const project = await createProjectFromImport(projectInfo, body.color);

    await logSystem('INFO', 'SYSTEM', `Project imported: ${project.name}`, projectInfo.path);

    return NextResponse.json({
      success: true,
      project,
      projectInfo,
    });
  } catch (error) {
    console.error('Failed to import project:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    await logSystem('ERROR', 'SYSTEM', 'Failed to import project', errorMessage);

    return NextResponse.json(
      { error: 'Failed to import project', details: errorMessage },
      { status: 500 }
    );
  }
}

// GET branches for a git URL
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gitUrl = searchParams.get('gitUrl');
    const localPath = searchParams.get('path');

    if (gitUrl) {
      const branches = await getBranches(gitUrl);
      return NextResponse.json({ branches });
    }

    if (localPath) {
      const info = await detectProjectType(localPath);
      return NextResponse.json({ projectInfo: info });
    }

    return NextResponse.json(
      { error: 'gitUrl or path parameter required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Failed to get info:', error);
    return NextResponse.json(
      { error: 'Failed to get info' },
      { status: 500 }
    );
  }
}
