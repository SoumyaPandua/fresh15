import sendResponse from "../../utils/sendResponse.js";
import { chat, getConversation, listConversations } from "./ai.service.js";

const rate = new Map();
const WINDOW = 60_000;
const LIMIT = 10;
const getIp = (req) => (typeof req.headers["x-forwarded-for"] === "string" ? req.headers["x-forwarded-for"].split(",")[0].trim() : req.ip || req.socket?.remoteAddress || "unknown");

function allowed(req) {
  const ip = getIp(req); const now = Date.now(); const entry = rate.get(ip);
  if (!entry || now - entry.started >= WINDOW) { rate.set(ip,{started:now,count:1}); return true; }
  if (entry.count >= LIMIT) return false;
  entry.count += 1; return true;
}

export const postChat = async (req,res,next) => { try { if (!allowed(req)) return res.status(429).json({success:false,message:"Too many AI requests. Please try again in a minute.",code:"AI_RATE_LIMIT",data:null,errors:[]}); const data = await chat({user:req.user,message:req.body?.message,conversationId:req.body?.conversationId,req}); return sendResponse(res,200,true,"AI response generated successfully",data); } catch(e) { next(e); } };
export const getChats = async (req,res,next) => { try { return sendResponse(res,200,true,"AI conversations fetched successfully",await listConversations(req.user._id)); } catch(e){next(e);} };
export const getChat = async (req,res,next) => { try { const data=await getConversation(req.user._id,req.params.id); if(!data) return res.status(404).json({success:false,message:"Conversation not found",code:"AI_CONVERSATION_NOT_FOUND",data:null,errors:[]}); return sendResponse(res,200,true,"AI conversation fetched successfully",data); } catch(e){next(e);} };
