
import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder } from 'obsidian';

export class FsEditor{
    fs;
    path;
    plugin :Plugin;

    constructor(plugin:Plugin){
        this.plugin = plugin;
        this.fs = require('fs');
        this.path = require('path');
    }

    get root(){
        let a = this.plugin.app.vault.adapter as any;
        return a.basePath.replace(/\\/g,'/');
    }

    abspath(tfile:TFile){
		if(tfile){
			return this.root+'/'+tfile.path;
		}else{
			return null;
		}
	}

    isfile(path:string){
        return this.fs.existsSync(path) && this.fs.statSync(path).isFile();
    }

    isdir(path:string){
        return this.fs.existsSync(path) && this.fs.statSync(path).isDirectory();
    }

    first_valid_dir(paths:Array<string>|string){
        for(let path of paths){
            if(this.isdir(path)){
                return path;
            }
        }
        return null;
    }

    async select_valid_dir(paths:Array<string>){
        let xpaths = paths.filter((p:string)=>this.isdir(p));
        if(xpaths.length===0){
            return null;
        }else if(xpaths.length==1){
            return xpaths[0];
        }else{
            let nc = (this.plugin.app as any).plugins.getPlugin('note-chain');
            if(nc){
                let path = await nc.chain.tp_suggester(xpaths,xpaths);
                return path;
            }else{
                return null;
            }
        }
    }
    

    mkdir_recursive(path:string){
        if(this.isdir(path)){return true;}
        const parent = this.path.dirname(path);
        if(!this.isdir(parent)){
            this.mkdir_recursive(parent);
        }
        this.fs.mkdirSync(path);
    }

    /**
	* 附件 src 到 dst，不在 vault 中，需要绝对路径
	* overwrite，复盖；mtime，新文件；
	*/
    copy_file(src:string,dst:string,mode='pass>overwrite>mtime') {
        const fs = this.fs;

        mode = mode.split('>')[0]
        if(!fs.existsSync(src)){
            return false;
        }
        if(fs.existsSync(dst)){
            if(mode==='overwrite'){
                fs.unlinkSync(dst);
                fs.copyFileSync(src,dst);
                new Notice(`Copy:${src}-->${dst}`,5000);
                return true;
            }else if(mode==='mtime'){
                // dst 更新时间小于 src
                if(fs.statSync(dst).mtimeMs<fs.statSync(src).mtimeMs){
                    fs.unlinkSync(dst);
                    fs.copyFileSync(src,dst);
                    new Notice(`Copy:${src}-->${dst}`,5000);
                    return true;
                }
            }
        }else{
            fs.copyFileSync(src,dst);
            new Notice(`Copy:${src}-->${dst}`,5000);
            return true;
        }
        return false;
    }

    copy_tfile(tfile:TFile, dst:string,mode='mtime') {
		if(tfile){
			let src = this.abspath(tfile);
			return src && this.copy_file(src,dst,mode);
		}
        return false;
	}

    mirror_tfile(tfile:TFile,vault_root:string,mode='mtime',attachment=true,outlink=false){
        // 将笔记镜像移动到别的库中，文件结构与当前库相同
        if(tfile){
            vault_root = vault_root.replace(/\\g/,'/');
			let src = this.root + '/' + tfile.path;
            let dst = vault_root+'/'+tfile.path;
            this.mkdir_recursive(this.path.dirname(dst));
			this.copy_file(src,dst,mode);
            if(attachment){
                let nc = (this.plugin.app as any).plugins.getPlugin('note-chain');
                if(!nc){return;}
                let tfiles = nc.chain.get_outlinks(tfile);
                for(let t of tfiles){
                    if(!(t.extension==='md')){
                        this.mirror_tfile(t,vault_root,mode,false);
                    }else if(outlink){
                        this.mirror_tfile(t,vault_root,mode,false);
                    }
                }
            }
		}
    }

    mirror_tfolder(tfolder:TFolder,vault_root:string,mode='mtime',attachment=true,outlink=false){
        if(tfolder){
            for(let t of tfolder.children){
                if(t instanceof TFolder){
                    this.mirror_tfolder(t,vault_root,mode,attachment,outlink);
                }else if(t instanceof TFile){
                    this.mirror_tfile(t,vault_root,mode,attachment,outlink);
                }
            }
		}
    }

    modify(path:string,callback:Function,encoding='utf8'){
        const fs = this.fs;
        if(!fs.existsSync(path)){return};

        fs.readFile(path, encoding, (err:Error, data:string) => {
			if(err){
                console.error('Error reading file:', err);;
            }
            let rs = callback(path,data);
			fs.writeFile(path, rs, encoding, (err:Error) => {
			  if (err) {
				console.error('Error writing file:', err);
			  } else {
				console.log('File content updated successfully.');
			  }
			});
		  }
        );
    }
}
