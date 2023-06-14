export type attachment = {
    attachment: string,
    name: string,
    id: string,
    size: number,
    url: string,
    proxyUrl: string,
    height: number | null,
    width: number | null,
    contentType: any,
    description: any,
    ephemeral: any,
    duration: any,
    waveform: any
}
export type sticker = {
    description: null|string,
    format: number,
    id: string,
    name: string,
    tags: null|string,
    url:string
}
export type user = {
    name:string,
    id:string,
    tag:string,
    avatar:string
}