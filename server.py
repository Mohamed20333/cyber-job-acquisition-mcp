import os, sqlite3
from datetime import datetime, timezone
from typing import Optional
from mcp.server.fastmcp import FastMCP

DB_PATH = os.getenv('DB_PATH','applications.db')
mcp = FastMCP('Cyber Job Acquisition Engine', stateless_http=True, json_response=True)

def db():
    c=sqlite3.connect(DB_PATH); c.row_factory=sqlite3.Row
    c.execute('''CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT, company TEXT NOT NULL, role TEXT NOT NULL,
      url TEXT, location TEXT, source TEXT, fit_score INTEGER, status TEXT DEFAULT 'RESEARCH',
      recruiter TEXT, recruiter_url TEXT, message TEXT, notes TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL)'''); c.commit(); return c

def now(): return datetime.now(timezone.utc).isoformat()

@mcp.tool()
def health():
    c=db(); c.execute('SELECT 1').fetchone(); c.close(); return {'ok':True,'server':'cyber-job-acquisition','time':now()}

@mcp.tool()
def score_job(title:str, description:str, skills:str):
    text=f'{title} {description}'.lower(); st=skills.lower()
    weights={'red team':18,'penetration testing':18,'pentest':18,'ethical hacking':16,'soc':15,'security operations':15,'security engineer':14,'cybersecurity':12,'network security':12,'burp':8,'kali':8,'linux':7,'nmap':7,'python':6,'ctf':6,'siem':8,'splunk':8,'wireshark':7,'cloud':5}
    matched=[k for k,v in weights.items() if k in text and k in st]
    score=min(100,25+sum(weights[k] for k in matched))
    blockers=[]
    if any(x in text for x in ['5+ years','7+ years','10+ years']): blockers.append('Senior experience requirement')
    if 'clearance required' in text: blockers.append('Security clearance required')
    if 'must be authorized to work' in text: blockers.append('Work authorization may be required')
    return {'fit_score':score,'matched_terms':matched,'blockers':blockers,'interpretation':'High textual alignment' if score>=70 else 'Moderate textual alignment' if score>=50 else 'Low textual alignment','disclaimer':'Textual fit only; not a prediction of hiring outcome.'}

@mcp.tool()
def save_opportunity(company:str, role:str, url:str='', location:str='', source:str='', fit_score:Optional[int]=None, recruiter:str='', recruiter_url:str='', notes:str=''):
    c=db(); ts=now(); cur=c.execute('INSERT INTO applications (company,role,url,location,source,fit_score,recruiter,recruiter_url,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',(company,role,url,location,source,fit_score,recruiter,recruiter_url,notes,ts,ts)); c.commit(); i=cur.lastrowid; c.close(); return {'id':i,'status':'RESEARCH'}

@mcp.tool()
def list_opportunities(status:str='', limit:int=50):
    c=db(); q='SELECT * FROM applications'; args=[]
    if status: q+=' WHERE status=?'; args.append(status)
    q+=' ORDER BY updated_at DESC LIMIT ?'; args.append(min(limit,200)); rows=c.execute(q,args).fetchall(); c.close(); return [dict(r) for r in rows]

@mcp.tool()
def update_opportunity(opportunity_id:int,status:str,message:str='',notes:str=''):
    allowed={'RESEARCH','CONTACT_READY','APPLIED','FOLLOW_UP','REPLIED','REJECTED','CLOSED'}
    if status not in allowed: return {'error':f'Invalid status: {sorted(allowed)}'}
    c=db(); c.execute('UPDATE applications SET status=?, message=CASE WHEN ?="" THEN message ELSE ? END, notes=CASE WHEN ?="" THEN notes ELSE ? END, updated_at=? WHERE id=?',(status,message,message,notes,notes,now(),opportunity_id)); c.commit(); r=c.execute('SELECT * FROM applications WHERE id=?',(opportunity_id,)).fetchone(); c.close(); return dict(r) if r else {'error':'Opportunity not found'}

@mcp.tool()
def draft_outreach(person_name:str, company:str, role:str, why_relevant:str, request:str='brief conversation about the opportunity', include_cv:bool=False):
    cv=' I can share my CV if useful.' if include_cv else ''
    msg=f'Hi {person_name}, I came across the {role} opportunity at {company} and noticed {why_relevant}. I’m a cybersecurity student focused on hands-on security work and would value {request}.{cv} Best, Mohamed'
    return {'message':msg,'cv_recommendation':'Share the CV only when the recipient/channel permits it and the CV is tailored to the role.'}

@mcp.tool()
def generate_follow_up(person_name:str, company:str, original_context:str):
    return f'Hi {person_name}, just following up on my message about {company}. {original_context} If relevant, I’d be glad to share more details. Best, Mohamed'

@mcp.tool()
def get_workflow():
    return {'steps':['Discover legitimate remote cybersecurity roles from permitted/public sources.','Score textual fit against the real CV/skills.','Research company and public professional contacts where available.','Draft truthful role-specific outreach.','Decide whether CV sharing is appropriate.','Save and track the opportunity.','Human reviews and performs final external action.','Track replies and follow-ups.'],'not_automated':['Bulk LinkedIn connection requests','Bulk LinkedIn DMs','Credential collection','CAPTCHA solving','Cookie/session theft','Scraping behind login','Rate-limit evasion']}

if __name__=='__main__': mcp.run(transport='streamable-http')
