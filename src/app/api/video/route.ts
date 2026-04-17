import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync, statSync } from 'fs';
import path from 'path';

const VIDEO_DIR = path.join(process.cwd(), 'public', 'videos');
const CONFIG_FILE = path.join(VIDEO_DIR, 'video-config.json');
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

interface VideoConfig {
  type: 'upload' | 'youtube' | null;
  activeSource: 'upload' | 'youtube' | null; // Which source is currently playing
  youtubeUrls: string[]; // Array untuk playlist
  currentUrlIndex: number;
  uploadedFile: string | null; // Legacy: single uploaded file
  uploadedFiles: string[]; // Array untuk multiple uploaded videos
  currentUploadIndex: number; // Current uploaded video index
}

// Helper to read video config
async function getVideoConfig(): Promise<VideoConfig> {
  try {
    if (existsSync(CONFIG_FILE)) {
      const configStr = await (await import('fs/promises')).readFile(CONFIG_FILE, 'utf-8');
      const config = JSON.parse(configStr);
      // Backward compatibility: ensure new fields exist
      return {
        ...config,
        uploadedFiles: config.uploadedFiles || [],
        currentUploadIndex: config.currentUploadIndex || 0,
      };
    }
  } catch (error) {
    console.error('Error reading video config:', error);
  }
  return { 
    type: null, 
    activeSource: null, 
    youtubeUrls: [], 
    currentUrlIndex: 0, 
    uploadedFile: null,
    uploadedFiles: [],
    currentUploadIndex: 0,
  };
}

// Helper to save video config
async function saveVideoConfig(config: VideoConfig) {
  if (!existsSync(VIDEO_DIR)) {
    await mkdir(VIDEO_DIR, { recursive: true });
  }
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Helper to get next YouTube URL in playlist
export async function getNextYoutubeUrl(): Promise<{ url: string | null, index: number }> {
  const config = await getVideoConfig();
  if (config.type !== 'youtube' || config.youtubeUrls.length === 0) {
    return { url: null, index: -1 };
  }

  const currentIndex = config.currentUrlIndex || 0;
  const nextIndex = (currentIndex + 1) % config.youtubeUrls.length;
  
  // Update index
  config.currentUrlIndex = nextIndex;
  await saveVideoConfig(config);

  return { url: config.youtubeUrls[nextIndex], index: nextIndex };
}

// GET /api/video - Get current video info
export async function GET() {
  try {
    const config = await getVideoConfig();
    
    // Get info for currently active uploaded video
    let activeUploadInfo = null;
    if (config.type === 'upload' && config.uploadedFiles && config.uploadedFiles.length > 0) {
      const currentIndex = config.currentUploadIndex || 0;
      const currentFile = config.uploadedFiles[currentIndex];
      if (currentFile) {
        const videoPath = path.join(VIDEO_DIR, currentFile);
        if (existsSync(videoPath)) {
          const stats = statSync(videoPath);
          activeUploadInfo = {
            url: `/videos/${currentFile}`,
            filename: currentFile,
            name: currentFile,
            size: stats.size,
            lastModified: stats.mtime.toISOString(),
            index: currentIndex,
          };
        }
      }
    }

    // Get info for all uploaded videos
    const uploadedVideos = [];
    if (config.uploadedFiles && config.uploadedFiles.length > 0) {
      for (let i = 0; i < config.uploadedFiles.length; i++) {
        const file = config.uploadedFiles[i];
        const videoPath = path.join(VIDEO_DIR, file);
        if (existsSync(videoPath)) {
          const stats = statSync(videoPath);
          uploadedVideos.push({
            url: `/videos/${file}`,
            filename: file,
            name: file,
            size: stats.size,
            lastModified: stats.mtime.toISOString(),
            index: i,
            isActive: i === config.currentUploadIndex && config.activeSource === 'upload',
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      video: {
        exists: config.type !== null,
        type: config.type,
        activeSource: config.activeSource,
        url: activeUploadInfo?.url || null,
        youtubeUrls: config.youtubeUrls || [],
        currentUrlIndex: config.currentUrlIndex || 0,
        uploadedVideos,
        currentUploadIndex: config.currentUploadIndex || 0,
        lastModified: activeUploadInfo?.lastModified || null,
      },
    });
  } catch (error) {
    console.error('Error getting video info:', error);
    return NextResponse.json(
      { error: 'Failed to get video info' },
      { status: 500 }
    );
  }
}

// POST /api/video - Upload video or set YouTube link
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const youtubeUrl = formData.get('youtubeUrl') as string;
    const action = formData.get('action') as string;
    const source = formData.get('source') as 'upload' | 'youtube';
    const indexParam = formData.get('index') as string;

    // Handle switch active source
    if (action === 'switchSource') {
      const config = await getVideoConfig();
      if (source) {
        config.activeSource = source;
        
        // If switching to upload, optionally switch to specific index
        if (source === 'upload' && indexParam) {
          const uploadIndex = parseInt(indexParam);
          if (config.uploadedFiles && config.uploadedFiles[uploadIndex]) {
            config.currentUploadIndex = uploadIndex;
            config.uploadedFile = config.uploadedFiles[uploadIndex];
          }
        }
        
        await saveVideoConfig(config);

        return NextResponse.json({
          success: true,
          message: `Switched to ${source === 'upload' ? 'uploaded video' : 'YouTube playlist'}`,
          activeSource: config.activeSource,
        });
      }
      return NextResponse.json({ error: 'Source not specified' }, { status: 400 });
    }

    // Handle next video in playlist
    if (action === 'nextVideo') {
      const config = await getVideoConfig();
      if (config.type === 'youtube' && config.youtubeUrls.length > 0) {
        const newIndex = parseInt(indexParam) || 0;
        config.currentUrlIndex = newIndex % config.youtubeUrls.length;
        await saveVideoConfig(config);
        
        return NextResponse.json({
          success: true,
          currentIndex: config.currentUrlIndex,
          url: config.youtubeUrls[config.currentUrlIndex],
        });
      }
      return NextResponse.json({ error: 'No playlist' }, { status: 400 });
    }

    if (youtubeUrl) {
      // Validate YouTube URL
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/)|youtu\.be\/)/;
      if (!youtubeRegex.test(youtubeUrl)) {
        return NextResponse.json(
          { error: 'Invalid YouTube URL' },
          { status: 400 }
        );
      }

      const config = await getVideoConfig();
      
      // Add to playlist array
      const youtubeUrls = config.youtubeUrls || [];
      youtubeUrls.push(youtubeUrl);

      const newConfig: VideoConfig = {
        type: 'youtube',
        youtubeUrls,
        currentUrlIndex: youtubeUrls.length - 1,
        uploadedFile: null,
        uploadedFiles: config.uploadedFiles || [],
        currentUploadIndex: config.currentUploadIndex || 0,
        activeSource: config.activeSource === 'youtube' ? 'youtube' : (youtubeUrls.length === 1 ? 'youtube' : config.activeSource),
      };

      await saveVideoConfig(newConfig);

      return NextResponse.json({
        success: true,
        message: 'YouTube URL added to playlist',
        video: {
          type: 'youtube',
          youtubeUrls,
          totalCount: youtubeUrls.length,
        },
      });
    }

    // Otherwise, it's a file upload
    const file = formData.get('video') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No video file or YouTube URL provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('video/')) {
      return NextResponse.json(
        { error: 'Invalid file type. Only video files are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 500MB.' },
        { status: 400 }
      );
    }

    // Create videos directory if it doesn't exist
    if (!existsSync(VIDEO_DIR)) {
      await mkdir(VIDEO_DIR, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const originalName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
    const extension = file.name.split('.').pop();
    const filename = `upload-${timestamp}-${originalName}.${extension}`;
    const videoPath = path.join(VIDEO_DIR, filename);

    // Save video file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(videoPath, buffer);

    const config = await getVideoConfig();
    
    // Add to uploaded files array
    const uploadedFiles = config.uploadedFiles || [];
    uploadedFiles.push(filename);
    const newUploadIndex = uploadedFiles.length - 1;

    const newConfig: VideoConfig = {
      type: 'upload',
      youtubeUrls: [],
      currentUrlIndex: 0,
      uploadedFile: filename, // Keep for backward compatibility
      uploadedFiles,
      currentUploadIndex: newUploadIndex,
      activeSource: 'upload', // Auto-activate uploaded video
    };

    await saveVideoConfig(newConfig);

    return NextResponse.json({
      success: true,
      message: 'Video uploaded successfully',
      video: {
        type: 'upload',
        url: `/videos/${filename}`,
        filename,
        name: file.name,
        size: file.size,
        fileType: file.type,
        index: newUploadIndex,
      },
    });
  } catch (error) {
    console.error('Error uploading video:', error);
    return NextResponse.json(
      { error: 'Failed to upload video' },
      { status: 500 }
    );
  }
}

// DELETE /api/video - Delete current video or clear YouTube URL
// DELETE /api/video?url=<index> - Delete specific YouTube video by index
// DELETE /api/video?uploaded=<index> - Delete specific uploaded video by index
// DELETE /api/video?all=true - Delete all videos
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const urlIndex = searchParams.get('url');
    const uploadedIndex = searchParams.get('uploaded');
    const deleteAll = searchParams.get('all');

    // Delete specific YouTube video by index
    if (urlIndex !== null) {
      const index = parseInt(urlIndex);
      const config = await getVideoConfig();
      
      if (config.type !== 'youtube' || !config.youtubeUrls || config.youtubeUrls.length === 0) {
        return NextResponse.json({ error: 'No YouTube playlist' }, { status: 400 });
      }

      if (index < 0 || index >= config.youtubeUrls.length) {
        return NextResponse.json({ error: 'Invalid index' }, { status: 400 });
      }

      // Remove URL at index
      const newUrls = config.youtubeUrls.filter((_, i) => i !== index);
      
      // Update config
      const newConfig: VideoConfig = {
        ...config,
        youtubeUrls: newUrls,
        currentUrlIndex: newUrls.length === 0 ? 0 : Math.min(config.currentUrlIndex, newUrls.length - 1),
      };

      // If playlist is now empty, clear activeSource
      if (newUrls.length === 0) {
        newConfig.activeSource = null;
        newConfig.type = null;
      }

      await saveVideoConfig(newConfig);

      return NextResponse.json({
        success: true,
        message: 'YouTube video removed from playlist',
        remainingCount: newUrls.length,
      });
    }

    // Delete specific uploaded video by index
    if (uploadedIndex !== null) {
      const index = parseInt(uploadedIndex);
      const config = await getVideoConfig();
      
      if (!config.uploadedFiles || config.uploadedFiles.length === 0) {
        return NextResponse.json({ error: 'No uploaded videos' }, { status: 400 });
      }

      if (index < 0 || index >= config.uploadedFiles.length) {
        return NextResponse.json({ error: 'Invalid index' }, { status: 400 });
      }

      // Delete file from disk
      const filename = config.uploadedFiles[index];
      const filePath = path.join(VIDEO_DIR, filename);
      
      if (existsSync(filePath)) {
        await unlink(filePath);
      }

      // Remove from array
      const newUploadedFiles = config.uploadedFiles.filter((_, i) => i !== index);
      
      const newConfig: VideoConfig = {
        ...config,
        uploadedFiles: newUploadedFiles,
        uploadedFile: newUploadedFiles.length > 0 ? newUploadedFiles[Math.min(index, newUploadedFiles.length - 1)] : null,
        currentUploadIndex: newUploadedFiles.length > 0 ? Math.min(index, newUploadedFiles.length - 1) : 0,
      };

      // If this was the last uploaded video and activeSource was upload, clear it
      if (newUploadedFiles.length === 0 && config.activeSource === 'upload') {
        newConfig.activeSource = null;
        newConfig.type = null;
      } else if (config.activeSource === 'upload' && config.currentUploadIndex === index) {
        // If we deleted the active one, switch to another
        newConfig.currentUploadIndex = Math.min(index, newUploadedFiles.length - 1);
        newConfig.uploadedFile = newUploadedFiles[newConfig.currentUploadIndex];
      } else if (config.activeSource === 'upload' && config.currentUploadIndex > index) {
        // Adjust index if we deleted a video before the current one
        newConfig.currentUploadIndex = config.currentUploadIndex - 1;
      }

      await saveVideoConfig(newConfig);

      return NextResponse.json({
        success: true,
        message: 'Uploaded video deleted',
        remainingCount: newUploadedFiles.length,
      });
    }

    // Default: Delete all videos (current behavior)
    if (deleteAll === 'true' || urlIndex === null && uploadedIndex === null) {
      // Delete all uploaded files
      const config = await getVideoConfig();
      if (config.uploadedFiles && config.uploadedFiles.length > 0) {
        for (const file of config.uploadedFiles) {
          const filePath = path.join(VIDEO_DIR, file);
          if (existsSync(filePath)) {
            await unlink(filePath);
          }
        }
      }

      // Also delete legacy tv-video.mp4 if exists
      const legacyPath = path.join(VIDEO_DIR, 'tv-video.mp4');
      if (existsSync(legacyPath)) {
        await unlink(legacyPath);
      }

      // Clear config with activeSource
      await saveVideoConfig({
        type: null,
        activeSource: null,
        youtubeUrls: [],
        currentUrlIndex: 0,
        uploadedFile: null,
        uploadedFiles: [],
        currentUploadIndex: 0,
      });

      return NextResponse.json({
        success: true,
        message: 'All videos removed successfully',
      });
    }

    return NextResponse.json({
      error: 'No delete parameter specified',
    }, { status: 400 });
  } catch (error) {
    console.error('Error deleting video:', error);
    return NextResponse.json(
      { error: 'Failed to delete video' },
      { status: 500 }
    );
  }
}
