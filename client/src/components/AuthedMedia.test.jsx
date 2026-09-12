// @vitest-environment jsdom
import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,act} from '@testing-library/react';
import {AuthedVideo} from './AuthedMedia';
import api from '../lib/api';
vi.mock('../lib/api',()=>({default:{get:vi.fn()}}));
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('keeps autoplay inline and muted after private video finishes loading',async()=>{
 let finish;api.get.mockReturnValue(new Promise(r=>{finish=r;}));
 vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:vi.fn(()=> 'blob:video'),revokeObjectURL:vi.fn()}));
 const {container}=render(<AuthedVideo src="/memories/video/file" autoPlay muted playsInline controls showFullscreenButton/>);
 expect(screen.queryByRole('button',{name:'Full screen'})).toBeNull();
 await act(async()=>{finish({data:new Blob(['video'])});});
 const video=container.querySelector('video');
 expect(video.autoplay).toBe(true);expect(video.muted).toBe(true);expect(video.playsInline).toBe(true);expect(video.controls).toBe(true);
 expect(screen.getByRole('button',{name:'Full screen'})).toBeTruthy();
});
it.each(['requestFullscreen','webkitEnterFullscreen'])('opens the existing video with %s',async(method)=>{
 const {container}=render(<AuthedVideo src="https://example.com/video.mp4" controls showFullscreenButton/>);
 const video=container.querySelector('video');video[method]=vi.fn().mockResolvedValue(undefined);
 fireEvent.click(screen.getByRole('button',{name:'Full screen'}));
 expect(video[method]).toHaveBeenCalledOnce();
});
it('keeps playback available and explains when fullscreen is unavailable',async()=>{
 const {container}=render(<AuthedVideo src="https://example.com/video.mp4" controls showFullscreenButton/>);
 fireEvent.click(screen.getByRole('button',{name:'Full screen'}));
 expect(await screen.findByRole('status')).toBeTruthy();expect(container.querySelector('video').controls).toBe(true);
});
